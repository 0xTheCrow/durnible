import type { MouseEventHandler, RefObject } from 'react';
import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { Room } from 'matrix-js-sdk';
import { Box, Chip, Icon, Icons, Scroll, Spinner, Text, config } from 'folds';
import type { EditorController } from '../../../components/editor';
import { TimelineMessageContext } from '../timeline/TimelineMessageContext';
import { MemoizedTimelineEvent } from '../timeline/MemoizedTimelineEvent';
import { TimelineOverlay } from '../timeline/TimelineOverlay';
import type { Timeline } from '../timeline/timelineState';
import { getInitialTimeline, loadEventContext, PAGINATION_LIMIT } from '../timeline/timelineState';
import { getTimelinesEventsCount } from '../timeline/timelineUtils';
import { willEventRender } from '../timeline/willEventRender';
import { useVirtualPaginator } from '../../../hooks/useVirtualPaginator';
import { useMatrixClient } from '../../../hooks/useMatrixClient';
import { getEditedEvent, getEventReactions } from '../../../utils/room';
import { computeAnchorScrollTop, scrollToBottom } from '../../../utils/dom';
import { markAsRead } from '../../../utils/notifications';
import { useSetting } from '../../../state/hooks/settings';
import { settingsAtom } from '../../../state/settings';
import { buildTimelineDescriptors } from '../../../utils/buildTimelineDescriptors';
import { BackPaginationSkeletons } from './components/BackPaginationSkeletons';
import { ForwardPaginationSkeletons } from './components/ForwardPaginationSkeletons';
import {
  NewMessagesDivider,
  NEW_MESSAGES_DIVIDER_ANCHOR_ID,
} from './components/NewMessagesDivider';
import { DayDivider } from './components/DayDivider';
import { useAtBottom } from './hooks/useAtBottom';
import { useNearBottom } from './hooks/useNearBottom';
import { useLiveTimelineUpdates } from './hooks/useLiveTimelineUpdates';
import { useScrollAnchor } from './hooks/useScrollAnchor';
import { useStickyBottom } from './hooks/useStickyBottom';
import { useTimelineMessageContextValue } from './hooks/useTimelineMessageContextValue';
import { usePaginationState } from './hooks/usePaginationState';
import { useAutoMarkAsRead } from './hooks/useAutoMarkAsRead';
import { resolveTimelineEvents } from './utils/resolveTimelineEvents';

type RoomTimelineV2Props = {
  room: Room;
  eventId?: string;
  roomInputRef: RefObject<HTMLElement>;
  editorInputRef: RefObject<EditorController | null>;
};

export function RoomTimelineV2({
  room,
  eventId,
  roomInputRef: _roomInputRef,
  editorInputRef,
}: RoomTimelineV2Props) {
  const mx = useMatrixClient();
  const scrollRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const [timeline, setTimeline] = useState<Timeline>(() => getInitialTimeline(room));
  const [editId, setEditId] = useState<string>();
  const [dividerReadUptoEventId, setDividerReadUptoEventId] = useState<string | undefined>(
    () => room.getEventReadUpTo(room.client.getUserId() ?? '') ?? undefined
  );
  const [dividerEl, setDividerEl] = useState<HTMLDivElement | null>(null);
  const [dividerInView, setDividerInView] = useState(true);
  const [pendingJumpToDivider, setPendingJumpToDivider] = useState(false);
  const [focusEventId, setFocusEventId] = useState<string | undefined>();
  const [highlightFocus, setHighlightFocus] = useState(false);
  const [isJumpLoading, setIsJumpLoading] = useState(false);
  const eventIdAtMountRef = useRef(eventId);
  const openEventRequestRef = useRef(0);

  const [messageLayout] = useSetting(settingsAtom, 'messageLayout');
  const [showHiddenEvents] = useSetting(settingsAtom, 'showHiddenEvents');
  const [hideMembershipEvents] = useSetting(settingsAtom, 'hideMembershipEvents');
  const [hideNickAvatarEvents] = useSetting(settingsAtom, 'hideNickAvatarEvents');
  const [unfocusedAutoScroll] = useSetting(settingsAtom, 'unfocusedAutoScroll');
  const [hideActivity] = useSetting(settingsAtom, 'hideActivity');

  const {
    handleTimelinePagination,
    canPaginateBack,
    rangeAtOldest,
    isForwardPaginating,
    liveTimelineLinked,
    rangeAtNewest,
  } = usePaginationState(room, timeline, setTimeline);

  const { atBottom, atBottomRef, atBottomAnchorRef } = useAtBottom({ scrollRef });
  const { nearBottomRef, nearBottomAnchorRef } = useNearBottom({ scrollRef });

  const { readReceiptEventId, readReceiptLoaded, roomIsUnread } = useAutoMarkAsRead({
    mx,
    room,
    hideActivity,
    atBottom,
    atBottomRef,
  });

  useLayoutEffect(() => {
    const scrollEl = scrollRef.current;
    if (!scrollEl) return;
    if (!eventIdAtMountRef.current) {
      const mountDivider = scrollEl.querySelector<HTMLElement>(
        `[data-anchor-id="${NEW_MESSAGES_DIVIDER_ANCHOR_ID}"]`
      );
      if (mountDivider) {
        const offset = Math.round(scrollEl.clientHeight * 0.12);
        scrollEl.scrollTo({
          top: computeAnchorScrollTop(scrollEl, mountDivider, 'start', offset),
          behavior: 'instant',
        });
        return;
      }
    }
    scrollToBottom(scrollEl);
  }, []);

  const handleOpenEvent = useCallback(
    async (evtId: string, { highlight = true }: { highlight?: boolean } = {}) => {
      const requestId = openEventRequestRef.current + 1;
      openEventRequestRef.current = requestId;

      const loadingTimer = window.setTimeout(() => {
        if (openEventRequestRef.current !== requestId) return;
        setIsJumpLoading(true);
      }, 1500);

      const contextSize = Math.floor(PAGINATION_LIMIT / 2);
      const result = await loadEventContext(mx, room, evtId, contextSize);
      // A newer handleOpenEvent call superseded this one — drop the stale result
      // so it doesn't overwrite the in-flight target with a previously-clicked one.
      if (openEventRequestRef.current !== requestId) {
        window.clearTimeout(loadingTimer);
        return;
      }
      window.clearTimeout(loadingTimer);
      setIsJumpLoading(false);
      if (!result) return;

      const totalCount = getTimelinesEventsCount(result.linkedTimelines);
      setTimeline({
        linkedTimelines: result.linkedTimelines,
        range: {
          oldest: Math.max(0, result.absoluteIndex - contextSize),
          newest: Math.min(totalCount, result.absoluteIndex + contextSize),
        },
      });
      setFocusEventId(evtId);
      setHighlightFocus(highlight);
    },
    [mx, room]
  );

  useLayoutEffect(() => {
    if (eventId) handleOpenEvent(eventId);
  }, [eventId, handleOpenEvent]);

  useEffect(() => {
    if (!highlightFocus) return undefined;
    const timer = window.setTimeout(() => setHighlightFocus(false), 2000);
    return () => window.clearTimeout(timer);
  }, [highlightFocus]);

  const setScrollAnchor = useScrollAnchor({ scrollRef, contentRef });

  useLayoutEffect(() => {
    setScrollAnchor(editId ? `[data-message-id="${CSS.escape(editId)}"]` : null, {
      align: 'center',
    });
  }, [editId, setScrollAnchor]);

  useLayoutEffect(() => {
    setScrollAnchor(focusEventId ? `[data-message-id="${CSS.escape(focusEventId)}"]` : null, {
      align: 'start',
      offsetFraction: 0.12,
    });
  }, [focusEventId, setScrollAnchor]);

  useStickyBottom({ scrollRef, contentRef });

  useLiveTimelineUpdates({ room, setTimeline, nearBottomRef, unfocusedAutoScroll });

  useEffect(() => {
    const scrollEl = scrollRef.current;
    if (!dividerEl || !scrollEl) {
      setDividerInView(true);
      return undefined;
    }
    const io = new IntersectionObserver(
      ([entry]) => setDividerInView(entry?.isIntersecting ?? false),
      { root: scrollEl, threshold: 0 }
    );
    io.observe(dividerEl);
    return () => io.disconnect();
  }, [dividerEl]);

  useLayoutEffect(() => {
    if (!pendingJumpToDivider) return;
    const scrollEl = scrollRef.current;
    if (!scrollEl) {
      setPendingJumpToDivider(false);
      return;
    }
    const dividerElement = scrollEl.querySelector<HTMLElement>(
      `[data-anchor-id="${NEW_MESSAGES_DIVIDER_ANCHOR_ID}"]`
    );
    if (dividerElement) {
      const offset = Math.round(scrollEl.clientHeight * 0.12);
      scrollEl.scrollTo({
        top: computeAnchorScrollTop(scrollEl, dividerElement, 'start', offset),
        behavior: 'instant',
      });
    }
    setPendingJumpToDivider(false);
  }, [pendingJumpToDivider]);

  const handleMarkAsRead = () => {
    setDividerReadUptoEventId(undefined);
    markAsRead(mx, room.roomId, hideActivity);
  };

  const handleJumpToUnread = async () => {
    const scrollEl = scrollRef.current;
    if (!scrollEl) return;
    if (dividerEl) {
      const offset = Math.round(scrollEl.clientHeight * 0.12);
      scrollEl.scrollTo({
        top: computeAnchorScrollTop(scrollEl, dividerEl, 'start', offset),
        behavior: 'smooth',
      });
      return;
    }
    if (!readReceiptEventId) return;
    const contextSize = Math.floor(PAGINATION_LIMIT / 2);
    const result = await loadEventContext(mx, room, readReceiptEventId, contextSize);
    if (!result) return;
    const totalCount = getTimelinesEventsCount(result.linkedTimelines);
    setTimeline({
      linkedTimelines: result.linkedTimelines,
      range: {
        oldest: Math.max(0, result.absoluteIndex - contextSize),
        newest: Math.min(totalCount, result.absoluteIndex + contextSize),
      },
    });
    setPendingJumpToDivider(true);
  };

  const showCaseB = roomIsUnread && !!readReceiptEventId && !readReceiptLoaded;
  const showChips = (!!dividerEl && !dividerInView) || showCaseB;

  const eventsLength = getTimelinesEventsCount(timeline.linkedTimelines);

  const getScrollElement = useCallback(() => scrollRef.current, []);
  const getItemElement = useCallback(
    (index: number) =>
      (scrollRef.current?.querySelector(`[data-message-item="${index}"]`) as HTMLElement) ??
      undefined,
    []
  );

  const { getItems, observeBackAnchor, observeFrontAnchor } = useVirtualPaginator({
    count: eventsLength,
    limit: PAGINATION_LIMIT,
    range: { start: timeline.range.oldest, end: timeline.range.newest },
    onRangeChange: useCallback(
      (r) => setTimeline((cs) => ({ ...cs, range: { oldest: r.start, newest: r.end } })),
      []
    ),
    getScrollElement,
    getItemElement,
    onEnd: handleTimelinePagination,
  });

  const handleEdit = useCallback(
    (editEvtId?: string) => {
      if (editEvtId) {
        setEditId(editEvtId);
        return;
      }
      setEditId(undefined);
      editorInputRef.current?.focus();
    },
    [editorInputRef]
  );

  const handleOpenReply = useCallback<MouseEventHandler<HTMLButtonElement>>(
    (evt) => {
      const targetId = evt.currentTarget.getAttribute('data-event-id');
      if (!targetId) return;
      handleOpenEvent(targetId);
    },
    [handleOpenEvent]
  );

  const contextValue = useTimelineMessageContextValue({
    room,
    editorInputRef,
    editId,
    handleEdit,
    handleOpenReply,
  });

  const willRender = (mEvent: Parameters<typeof willEventRender>[0]) =>
    willEventRender(mEvent, {
      showHiddenEvents,
      hideMembershipEvents,
      hideNickAvatarEvents,
    });

  const events = resolveTimelineEvents(timeline.linkedTimelines, getItems(), willRender);
  const timelineItems = buildTimelineDescriptors(
    events,
    dividerReadUptoEventId,
    mx.getSafeUserId(),
    willRender
  );

  const showBackSkeletons = canPaginateBack || !rangeAtOldest;

  return (
    <TimelineMessageContext.Provider value={contextValue}>
      <Box grow="Yes" style={{ position: 'relative' }}>
        {isJumpLoading && (
          <TimelineOverlay position="Top">
            <Chip variant="SurfaceVariant" radii="Pill" outlined before={<Spinner size="50" />}>
              <Text size="L400">Loading…</Text>
            </Chip>
          </TimelineOverlay>
        )}
        {showChips && (
          <TimelineOverlay position="Top">
            <Chip
              variant="Primary"
              radii="Pill"
              outlined
              before={<Icon size="50" src={Icons.MessageUnread} />}
              onClick={handleJumpToUnread}
            >
              <Text size="L400">Jump to Unread</Text>
            </Chip>
            <Chip
              variant="SurfaceVariant"
              radii="Pill"
              outlined
              before={<Icon size="50" src={Icons.CheckTwice} />}
              onClick={handleMarkAsRead}
            >
              <Text size="L400">Mark as Read</Text>
            </Chip>
          </TimelineOverlay>
        )}
        <Scroll ref={scrollRef} visibility="Hover" style={{ overscrollBehavior: 'none' }}>
          <Box
            ref={contentRef}
            direction="Column"
            justifyContent="End"
            style={{
              minHeight: '100%',
              padding: `${config.space.S600} 0`,
            }}
          >
            {showBackSkeletons && (
              <BackPaginationSkeletons layout={messageLayout} anchorRef={observeBackAnchor} />
            )}

            {timelineItems.map((d) => {
              if (d.type === 'new-messages') {
                return (
                  <NewMessagesDivider key={d.key} ref={setDividerEl} onClick={handleMarkAsRead} />
                );
              }
              if (d.type === 'day-divider') {
                return <DayDivider key={d.key} ts={d.ts} />;
              }
              return (
                <MemoizedTimelineEvent
                  key={d.mEventId}
                  mEvent={d.mEvent}
                  mEventId={d.mEventId}
                  timelineSet={d.timelineSet}
                  item={d.item}
                  collapsed={d.collapsed}
                  groupedImages={d.groupedImages}
                  isHighlighted={highlightFocus && d.mEventId === focusEventId}
                  isEditing={editId === d.mEventId}
                  reactionRelations={getEventReactions(d.timelineSet, d.mEventId)}
                  editedEvent={getEditedEvent(d.mEventId, d.mEvent, d.timelineSet)}
                  isRedacted={d.mEvent.isRedacted()}
                  eventStatus={d.mEvent.status}
                />
              );
            })}

            {!(liveTimelineLinked && rangeAtNewest) && <div ref={observeFrontAnchor} />}
            {isForwardPaginating && <ForwardPaginationSkeletons layout={messageLayout} />}

            <span ref={nearBottomAnchorRef} />
            <span ref={atBottomAnchorRef} />
          </Box>
        </Scroll>
      </Box>
    </TimelineMessageContext.Provider>
  );
}
