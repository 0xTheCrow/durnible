import type { MouseEventHandler, RefObject } from 'react';
import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import type { MatrixEvent, Room } from 'matrix-js-sdk';
import { useAtomValue, useSetAtom } from 'jotai';
import { Box, Chip, Icon, Icons, Scroll, Spinner, Text, config, toRem } from 'folds';
import type { EditorController } from '../../../components/editor';
import { TimelineMessageContext } from './TimelineMessageContext';
import { MemoizedTimelineEvent } from './MemoizedTimelineEvent';
import { TimelineOverlay } from './TimelineOverlay';
import { JumpToLatestButton } from './JumpToLatestButton';
import { SelectionActionBar } from './SelectionActionBar';
import { useBulkSelection } from './useBulkSelection';
import { timelineSliderPositionAtom, timelineSliderVisibleAtom } from './TimelineSlider';
import type { Timeline } from './timelineState';
import {
  getInitialTimeline,
  loadEventContext,
  useLiveTimelineRefresh,
  useLiveTimelineReset,
  PAGINATION_LIMIT,
} from './timelineState';
import { getLiveTimeline, getTimelinesEventsCount } from './timelineUtils';
import { useVirtualPaginator } from '../../../hooks/useVirtualPaginator';
import { useMatrixClient } from '../../../hooks/useMatrixClient';
import { useRoomNavigate } from '../../../hooks/useRoomNavigate';
import { useAlive } from '../../../hooks/useAlive';
import { useIgnoredUsers } from '../../../hooks/useIgnoredUsers';
import { RoomIntro } from '../../../components/room-intro';
import { getEditedEvent } from '../../../utils/room';
import { getReadReceiptEventId } from '../../../utils/room/receipts';
import { markAsRead } from '../../../utils/notifications';
import { useSetting } from '../../../state/hooks/settings';
import { MessageLayout, settingsAtom } from '../../../state/settings';
import { buildTimelineDescriptors } from './utils/buildTimelineDescriptors';
import { BackPaginationSkeletons } from './components/BackPaginationSkeletons';
import { ForwardPaginationSkeletons } from './components/ForwardPaginationSkeletons';
import {
  NewMessagesDivider,
  NEW_MESSAGES_DIVIDER_ANCHOR_ID,
} from './components/NewMessagesDivider';
import { DayDivider } from './components/DayDivider';
import { useIsLatestMessageBottomVisible } from './hooks/useIsLatestMessageBottomVisible';
import { useLiveTimelineUpdates } from './hooks/useLiveTimelineUpdates';
import { useScrollController } from './hooks/useScrollController';
import { useTimelineMessageContextValue } from './hooks/useTimelineMessageContextValue';
import { usePaginationState } from './hooks/usePaginationState';
import { useAutoMarkAsRead } from './hooks/useAutoMarkAsRead';
import { resolveTimelineEvents } from './utils/resolveTimelineEvents';
import { createTimelineWindow, getWindowRange } from './utils/timelineWindow';
import { traceTimelineScroll } from './utils/scrollTrace';
import { willEventRender } from './willEventRender';

type RoomTimelineProps = {
  room: Room;
  eventId?: string;
  roomInputRef: RefObject<HTMLElement>;
  editorInputRef: RefObject<EditorController | null>;
};

export function RoomTimeline({
  room,
  eventId,
  roomInputRef: _roomInputRef,
  editorInputRef,
}: RoomTimelineProps) {
  const mx = useMatrixClient();
  const { navigateRoom } = useRoomNavigate();
  const setSliderPosition = useSetAtom(timelineSliderPositionAtom);
  const scrollRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const [timeline, setTimeline] = useState<Timeline>(() => getInitialTimeline(room));
  const windowStartIndexHintRef = useRef<number>();
  const range = getWindowRange(
    timeline.linkedTimelines,
    timeline.window,
    windowStartIndexHintRef.current
  );
  windowStartIndexHintRef.current = range.oldest;
  const renderedRangeRef = useRef(range);
  renderedRangeRef.current = range;
  const [editId, setEditId] = useState<string>();
  const [dividerReadUptoEventId, setDividerReadUptoEventId] = useState<string | undefined>(() =>
    getReadReceiptEventId(room, mx.getSafeUserId())
  );
  const [dividerElement, setDividerElement] = useState<HTMLDivElement | null>(null);
  const [dividerInView, setDividerInView] = useState(true);
  const [pendingJumpToDivider, setPendingJumpToDivider] = useState(false);
  const [focusRequest, setFocusRequest] = useState<{ eventId: string; nonce: number }>();
  const [highlightFocus, setHighlightFocus] = useState(false);
  const [isJumpLoading, setIsJumpLoading] = useState(false);
  const openEventRequestRef = useRef(0);

  const [messageLayout] = useSetting(settingsAtom, 'messageLayout');
  const [showHiddenEvents] = useSetting(settingsAtom, 'showHiddenEvents');
  const [hideMembershipEvents] = useSetting(settingsAtom, 'hideMembershipEvents');
  const [hideNickAvatarEvents] = useSetting(settingsAtom, 'hideNickAvatarEvents');
  const [unfocusedAutoScroll] = useSetting(settingsAtom, 'unfocusedAutoScroll');
  const [hideActivity] = useSetting(settingsAtom, 'hideActivity');

  const ignoredUsersList = useIgnoredUsers();
  const ignoredUsersSet = useMemo(() => new Set(ignoredUsersList), [ignoredUsersList]);
  const sliderVisible = useAtomValue(timelineSliderVisibleAtom);

  const {
    handleTimelinePagination,
    canPaginateBack,
    rangeAtOldest,
    isForwardPaginating,
    liveTimelineLinked,
    rangeAtNewest,
  } = usePaginationState(room, timeline, range, setTimeline);

  const { selectionMode, selectedIds, bulkDeleting, handleBulkDelete, handleCancelSelection } =
    useBulkSelection(mx, room);

  const isInLivePaginationWindow = liveTimelineLinked && rangeAtNewest;

  useEffect(() => {
    traceTimelineScroll('timeline:mount', { roomId: room.roomId });
    return () => traceTimelineScroll('timeline:unmount', { roomId: room.roomId });
  }, [room.roomId]);

  const isInLivePaginationWindowRef = useRef(isInLivePaginationWindow);
  isInLivePaginationWindowRef.current = isInLivePaginationWindow;

  const unfocusedAutoScrollRef = useRef(unfocusedAutoScroll);
  unfocusedAutoScrollRef.current = unfocusedAutoScroll;

  const { isLatestMessageBottomVisible, latestMessageBottomRef } = useIsLatestMessageBottomVisible({
    scrollRef,
    isInLivePaginationWindow,
  });

  const scrollController = useScrollController({
    scrollRef,
    contentRef,
    isInLivePaginationWindowRef,
    latestMessageBottomRef,
    unfocusedAutoScrollRef,
  });

  const clearNewMessagesDivider = useCallback(() => setDividerReadUptoEventId(undefined), []);
  const { readReceiptEventId, roomIsUnread } = useAutoMarkAsRead({
    mx,
    room,
    hideActivity,
    isLatestMessageBottomVisible,
    onMarkAsRead: clearNewMessagesDivider,
  });

  const alive = useAlive();
  const mountSnapshotRef = useRef<{
    eventId: string | undefined;
    readReceiptEventId: string | undefined;
    roomIsUnread: boolean;
  }>();
  if (!mountSnapshotRef.current) {
    mountSnapshotRef.current = { eventId, readReceiptEventId, roomIsUnread };
  }
  const mountSnapshot = mountSnapshotRef.current;
  const [mountResolved, setMountResolved] = useState(
    () =>
      !mountSnapshot.eventId && !(mountSnapshot.roomIsUnread && mountSnapshot.readReceiptEventId)
  );
  const [pendingMountPlacement, setPendingMountPlacement] = useState(false);
  const didResolveMountRef = useRef(false);

  const handleOpenEvent = useCallback(
    async (targetEventId: string, { highlight = true }: { highlight?: boolean } = {}) => {
      const requestId = openEventRequestRef.current + 1;
      openEventRequestRef.current = requestId;

      const loadingTimer = window.setTimeout(() => {
        if (openEventRequestRef.current !== requestId) return;
        setIsJumpLoading(true);
      }, 1500);

      const contextSize = Math.floor(PAGINATION_LIMIT / 2);
      const result = await loadEventContext(mx, room, targetEventId, contextSize);
      // A newer handleOpenEvent call superseded this one — drop the stale result
      // so it doesn't overwrite the in-flight target with a previously-clicked one.
      if (openEventRequestRef.current !== requestId) {
        window.clearTimeout(loadingTimer);
        return;
      }
      window.clearTimeout(loadingTimer);
      setIsJumpLoading(false);
      setMountResolved(true);
      if (!result) return;

      const totalCount = getTimelinesEventsCount(result.linkedTimelines);
      setTimeline({
        linkedTimelines: result.linkedTimelines,
        window: createTimelineWindow(
          result.linkedTimelines,
          Math.max(0, result.absoluteIndex - contextSize),
          Math.min(totalCount, result.absoluteIndex + contextSize)
        ),
      });
      setFocusRequest({ eventId: targetEventId, nonce: requestId });
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

  const prevEditIdRef = useRef<string>();
  useLayoutEffect(() => {
    if (editId) {
      scrollController.pinToAnchor(
        `[data-message-id="${CSS.escape(editId)}"]`,
        { align: 'center' },
        { animate: true }
      );
    } else if (prevEditIdRef.current) {
      scrollController.release();
    }
    prevEditIdRef.current = editId;
  }, [editId, scrollController]);

  const hadFocusRef = useRef(false);
  useLayoutEffect(() => {
    if (focusRequest) {
      scrollController.pinToAnchor(`[data-message-id="${CSS.escape(focusRequest.eventId)}"]`, {
        align: 'start',
        offsetFraction: 0.12,
      });
      hadFocusRef.current = true;
    } else if (hadFocusRef.current) {
      scrollController.release();
      hadFocusRef.current = false;
    }
  }, [focusRequest, scrollController]);

  useLiveTimelineUpdates({
    room,
    setTimeline,
    scrollRef,
    checkIsLatestMessageBottomVisible: scrollController.checkIsLatestMessageBottomVisible,
    pinToLatestMessageBottom: scrollController.pinToLatestMessageBottom,
    unfocusedAutoScroll,
  });

  useLiveTimelineRefresh(
    room,
    useCallback(() => {
      if (liveTimelineLinked) {
        setTimeline(getInitialTimeline(room));
      }
    }, [room, liveTimelineLinked])
  );

  useLiveTimelineReset(
    room,
    useCallback(() => {
      if (!liveTimelineLinked) return;
      setTimeline((current) => ({
        ...current,
        linkedTimelines: [...current.linkedTimelines, getLiveTimeline(room)],
      }));
    }, [room, liveTimelineLinked])
  );

  useEffect(() => {
    const scrollElement = scrollRef.current;
    if (!dividerElement || !scrollElement) {
      setDividerInView(true);
      return undefined;
    }
    const intersectionObserver = new IntersectionObserver(
      ([entry]) => setDividerInView(entry?.isIntersecting ?? false),
      { root: scrollElement, threshold: 0 }
    );
    intersectionObserver.observe(dividerElement);
    return () => intersectionObserver.disconnect();
  }, [dividerElement]);

  useLayoutEffect(() => {
    if (!pendingJumpToDivider) return;
    scrollController.pinToAnchor(`[data-anchor-id="${NEW_MESSAGES_DIVIDER_ANCHOR_ID}"]`, {
      align: 'start',
      offsetFraction: 0.12,
    });
    setPendingJumpToDivider(false);
  }, [pendingJumpToDivider, scrollController]);

  const handleMarkAsRead = () => {
    setDividerReadUptoEventId(undefined);
    markAsRead(mx, room.roomId, hideActivity);
  };

  const handleJumpToUnread = async () => {
    if (dividerElement) {
      scrollController.pinToAnchor(
        `[data-anchor-id="${NEW_MESSAGES_DIVIDER_ANCHOR_ID}"]`,
        { align: 'start', offsetFraction: 0.12 },
        { animate: true }
      );
      return;
    }
    if (!readReceiptEventId) return;
    const contextSize = Math.floor(PAGINATION_LIMIT / 2);
    const result = await loadEventContext(mx, room, readReceiptEventId, contextSize);
    if (!result) return;
    const totalCount = getTimelinesEventsCount(result.linkedTimelines);
    setTimeline({
      linkedTimelines: result.linkedTimelines,
      window: createTimelineWindow(
        result.linkedTimelines,
        Math.max(0, result.absoluteIndex - contextSize),
        Math.min(totalCount, result.absoluteIndex + contextSize)
      ),
    });
    setPendingJumpToDivider(true);
  };

  const eventsLength = getTimelinesEventsCount(timeline.linkedTimelines);
  const { oldest: rangeOldest, newest: rangeNewest } = range;

  useEffect(() => {
    traceTimelineScroll('timelineWindow:change', {
      isInLivePaginationWindow,
      liveTimelineLinked,
      rangeAtNewest,
      rangeOldest,
      rangeNewest,
      eventsLength,
    });
  }, [
    isInLivePaginationWindow,
    liveTimelineLinked,
    rangeAtNewest,
    rangeOldest,
    rangeNewest,
    eventsLength,
  ]);

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
    range: { start: range.oldest, end: range.newest },
    onRangeChange: useCallback((nextRange) => {
      const renderedRange = renderedRangeRef.current;
      const startShift = nextRange.start - renderedRange.oldest;
      setTimeline((current) => {
        const currentStartIndex =
          getWindowRange(current.linkedTimelines, current.window).oldest + startShift;
        return {
          ...current,
          window: createTimelineWindow(
            current.linkedTimelines,
            Math.max(0, currentStartIndex),
            Math.max(0, currentStartIndex) + (nextRange.end - nextRange.start)
          ),
        };
      });
    }, []),
    getScrollElement,
    getItemElement,
    onEnd: handleTimelinePagination,
    shouldRestoreScroll: useCallback(() => {
      const intentKind = scrollController.intentRef.current?.kind;
      const isAnchorPinned = intentKind === 'anchor';
      traceTimelineScroll('paginator:shouldRestoreScroll', { intentKind, isAnchorPinned });
      return !isAnchorPinned;
    }, [scrollController]),
  });

  const handleEdit = useCallback(
    (editEventId?: string) => {
      if (editEventId) {
        setEditId(editEventId);
        return;
      }
      setEditId(undefined);
      editorInputRef.current?.focus();
    },
    [editorInputRef]
  );

  const handleOpenReply = useCallback<MouseEventHandler<HTMLButtonElement>>(
    (event) => {
      const targetId = event.currentTarget.getAttribute('data-event-id');
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

  const willRender = (mEvent: MatrixEvent) =>
    willEventRender(mEvent, {
      ignoredUsersSet,
      showHiddenEvents,
      hideMembershipEvents,
      hideNickAvatarEvents,
    });

  const { events, firstUnreadEventId } = resolveTimelineEvents(
    timeline.linkedTimelines,
    getItems(),
    willRender,
    dividerReadUptoEventId,
    mx.getSafeUserId()
  );
  const timelineItems = buildTimelineDescriptors(events, firstUnreadEventId);

  const isDividerOffscreen = !!dividerElement && !dividerInView;
  const isUnreadDividerMissing =
    mountResolved && roomIsUnread && !!readReceiptEventId && !firstUnreadEventId;
  const showUnreadChips =
    mountResolved &&
    !isLatestMessageBottomVisible &&
    (isDividerOffscreen || isUnreadDividerMissing);

  useLayoutEffect(() => {
    if (didResolveMountRef.current) return;
    didResolveMountRef.current = true;
    const scrollElement = scrollRef.current;
    if (!scrollElement) return;
    if (mountSnapshot.eventId) return;
    if (!(mountSnapshot.roomIsUnread && mountSnapshot.readReceiptEventId)) {
      scrollController.pinToLatestMessageBottom();
      setMountResolved(true);
      return;
    }
    if (firstUnreadEventId) {
      setPendingMountPlacement(true);
      return;
    }
    const boundaryEventId = mountSnapshot.readReceiptEventId;
    (async () => {
      const contextSize = Math.floor(PAGINATION_LIMIT / 2);
      const result = await loadEventContext(mx, room, boundaryEventId, contextSize);
      if (!alive()) return;
      if (!result) {
        setMountResolved(true);
        return;
      }
      const totalCount = getTimelinesEventsCount(result.linkedTimelines);
      setTimeline({
        linkedTimelines: result.linkedTimelines,
        window: createTimelineWindow(
          result.linkedTimelines,
          Math.max(0, result.absoluteIndex - contextSize),
          Math.min(totalCount, result.absoluteIndex + contextSize)
        ),
      });
      setPendingMountPlacement(true);
    })();
  }, [firstUnreadEventId, mountSnapshot, scrollController, mx, room, alive]);

  useLayoutEffect(() => {
    if (!pendingMountPlacement) return;
    setPendingMountPlacement(false);
    const scrollElement = scrollRef.current;
    if (scrollElement && firstUnreadEventId) {
      const dividerSelector = `[data-anchor-id="${NEW_MESSAGES_DIVIDER_ANCHOR_ID}"]`;
      const dividerNode = scrollElement.querySelector<HTMLElement>(dividerSelector);
      if (dividerNode) {
        scrollController.pinToAnchor(dividerSelector, { align: 'start', offsetFraction: 0.12 });
      }
    }
    setMountResolved(true);
  }, [pendingMountPlacement, firstUnreadEventId, scrollController]);

  const lastRenderedEventId = (() => {
    for (let i = timelineItems.length - 1; i >= 0; i -= 1) {
      const descriptor = timelineItems[i];
      if (descriptor.type === 'event') return descriptor.mEventId;
    }
    return null;
  })();

  const handleJumpToLatest = () => {
    traceTimelineScroll('jumpToLatest:click');
    if (eventId) navigateRoom(room.roomId, undefined, { replace: true });
    setTimeline(getInitialTimeline(room));
    scrollController.pinToLatestMessageBottom();
    setSliderPosition(1);
  };

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
        {showUnreadChips && (
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
        <Scroll
          ref={scrollRef}
          visibility="Hover"
          style={{ overscrollBehavior: 'none', overflowAnchor: 'none' }}
          data-testid="timeline-scroll"
        >
          <Box
            ref={contentRef}
            direction="Column"
            justifyContent="End"
            style={{
              minHeight: '100%',
              padding: `${config.space.S600} ${sliderVisible ? toRem(48) : '0'} ${
                config.space.S600
              } 0`,
              visibility: mountResolved ? undefined : 'hidden',
            }}
          >
            {!canPaginateBack && rangeAtOldest && getItems().length > 0 && (
              <div
                style={{
                  padding: `${config.space.S700} ${config.space.S400} ${config.space.S600} ${
                    messageLayout === MessageLayout.Compact ? config.space.S400 : toRem(64)
                  }`,
                }}
              >
                <RoomIntro room={room} />
              </div>
            )}
            {showBackSkeletons && (
              <BackPaginationSkeletons layout={messageLayout} anchorRef={observeBackAnchor} />
            )}

            {timelineItems.map((descriptor) => {
              if (descriptor.type === 'new-messages') {
                return (
                  <NewMessagesDivider
                    key={descriptor.key}
                    ref={setDividerElement}
                    onClick={handleMarkAsRead}
                  />
                );
              }
              if (descriptor.type === 'day-divider') {
                return <DayDivider key={descriptor.key} ts={descriptor.ts} />;
              }
              return (
                <MemoizedTimelineEvent
                  key={descriptor.mEventId}
                  mEvent={descriptor.mEvent}
                  mEventId={descriptor.mEventId}
                  timelineSet={descriptor.timelineSet}
                  item={descriptor.item}
                  collapsed={descriptor.collapsed}
                  groupedImages={descriptor.groupedImages}
                  isHighlighted={highlightFocus && descriptor.mEventId === focusRequest?.eventId}
                  isEditing={editId === descriptor.mEventId}
                  editedEvent={getEditedEvent(
                    descriptor.mEventId,
                    descriptor.mEvent,
                    descriptor.timelineSet
                  )}
                  isRedacted={descriptor.mEvent.isRedacted()}
                  eventStatus={descriptor.mEvent.status}
                />
              );
            })}

            <span data-testid="latest-message-bottom" ref={latestMessageBottomRef} />

            {!isInLivePaginationWindow && <div ref={observeFrontAnchor} />}
            {isForwardPaginating && <ForwardPaginationSkeletons layout={messageLayout} />}
          </Box>
        </Scroll>
        {mountResolved && (
          <JumpToLatestButton
            scrollRef={scrollRef}
            lastMessageId={isInLivePaginationWindow ? lastRenderedEventId : null}
            isLatestMessageBottomVisible={isLatestMessageBottomVisible}
            onClick={handleJumpToLatest}
          />
        )}
        {selectionMode && (
          <TimelineOverlay position="Bottom">
            <SelectionActionBar
              selectedCount={selectedIds.size}
              onDelete={handleBulkDelete}
              onCancel={handleCancelSelection}
              deleting={bulkDeleting}
            />
          </TimelineOverlay>
        )}
      </Box>
    </TimelineMessageContext.Provider>
  );
}
