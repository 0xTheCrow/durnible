/* eslint-disable react/destructuring-assignment */
import type { Dispatch, MouseEventHandler, RefObject, SetStateAction } from 'react';
import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import type {
  EventTimeline,
  EventTimelineSetHandlerMap,
  IContent,
  MatrixClient,
  MatrixEvent,
  Room,
  RoomEventHandlerMap,
} from 'matrix-js-sdk';
import { Direction, EventType, RoomEvent } from 'matrix-js-sdk';
import type { HTMLReactParserOptions } from 'html-react-parser';
import classNames from 'classnames';
import { ReactEditor } from 'slate-react';
import type { Editor } from 'slate';
import to from 'await-to-js';
import { useAtom, useAtomValue, useSetAtom } from 'jotai';
import type { ContainerColor } from 'folds';
import { Badge, Box, Chip, Icon, Icons, Line, Scroll, Text, as, color, config, toRem } from 'folds';
import { isKeyHotkey } from 'is-hotkey';
import type { Opts as LinkifyOpts } from 'linkifyjs';
import { eventWithShortcode, factoryEventSentBy, getMxIdLocalPart } from '../../utils/matrix';
import { useMatrixClient } from '../../hooks/useMatrixClient';
import { useVirtualPaginator } from '../../hooks/useVirtualPaginator';
import { useAlive } from '../../hooks/useAlive';
import { editableActiveElement, scrollToBottom } from '../../utils/dom';
import { DefaultPlaceholder, CompactPlaceholder, MessageBase } from '../../components/message';
import {
  factoryRenderLinkifyWithMention,
  getReactCustomHtmlParser,
  LINKIFY_OPTS,
  makeMentionCustomProps,
  renderMatrixMention,
} from '../../plugins/react-custom-html-parser';
import {
  canEditEvent,
  decryptAllTimelineEvent,
  getEditedEvent,
  getEventReactions,
  getLatestEditableEvt,
  getMemberDisplayName,
  getReactionContent,
  isMembershipChanged,
  reactionOrEditEvent,
} from '../../utils/room';
import { useSetting } from '../../state/hooks/settings';
import { MessageLayout, settingsAtom } from '../../state/settings';
import { RoomIntro } from '../../components/room-intro';
import { TimelineMessageContext } from './TimelineMessageContext';
import { MemoizedTimelineEvent } from './MemoizedTimelineEvent';
import { SelectionActionBar } from './SelectionActionBar';
import { selectionModeAtom, selectedIdsAtom } from './message/selectionAtom';
import {
  getIntersectionObserverEntry,
  useIntersectionObserver,
} from '../../hooks/useIntersectionObserver';
import { markAsRead } from '../../utils/notifications';

import { getResizeObserverEntry, useResizeObserver } from '../../hooks/useResizeObserver';
import * as css from './RoomTimeline.css';
import { timeDayMonthYear, today, yesterday } from '../../utils/time';
import { buildTimelineDescriptors } from '../../utils/buildTimelineDescriptors';
import { createMentionElement, isEmptyEditor, moveCursor } from '../../components/editor';
import { roomIdToReplyDraftAtomFamily } from '../../state/room/roomInputDrafts';
import { usePowerLevelsContext } from '../../hooks/usePowerLevels';
import { MessageEvent, StateEvent } from '../../../types/matrix/room';
import { useKeyDown } from '../../hooks/useKeyDown';
import { useDocumentFocusChange } from '../../hooks/useDocumentFocusChange';
import { roomToParentsAtom } from '../../state/room/roomToParents';
import { useRoomUnread } from '../../state/hooks/unread';
import { roomToUnreadAtom } from '../../state/room/roomToUnread';
import { useMentionClickHandler } from '../../hooks/useMentionClickHandler';
import { useSpoilerClickHandler } from '../../hooks/useSpoilerClickHandler';
import { useRoomNavigate } from '../../hooks/useRoomNavigate';
import { useMediaAuthentication } from '../../hooks/useMediaAuthentication';
import { useIgnoredUsers } from '../../hooks/useIgnoredUsers';
import { timelineSliderPositionAtom, timelineSliderVisibleAtom } from './TimelineSlider';
import { useImagePackRooms } from '../../hooks/useImagePackRooms';
import { useIsDirectRoom } from '../../hooks/useRoom';
import { useOpenUserRoomProfile } from '../../state/hooks/userRoomProfile';
import { useSpaceOptionally } from '../../hooks/useSpace';
import { useRoomCreators } from '../../hooks/useRoomCreators';
import { useRoomPermissions } from '../../hooks/useRoomPermissions';
import { useAccessiblePowerTagColors, useGetMemberPowerTag } from '../../hooks/useMemberPowerTag';
import { useTheme } from '../../hooks/useTheme';
import { useRoomCreatorsTag } from '../../hooks/useRoomCreatorsTag';
import { usePowerLevelTags } from '../../hooks/usePowerLevelTags';
import { ROOM_INPUT_EDITABLE_NAME } from './RoomInput';

const TimelineFloat = as<'div', css.TimelineFloatVariants>(
  ({ position, className, ...props }, ref) => (
    <Box
      className={classNames(css.TimelineFloat({ position }), className)}
      justifyContent="Center"
      alignItems="Center"
      gap="200"
      {...props}
      ref={ref}
    />
  )
);

const TimelineDivider = as<'div', { variant?: ContainerColor | 'Inherit' }>(
  ({ variant, children, ...props }, ref) => (
    <Box gap="100" justifyContent="Center" alignItems="Center" {...props} ref={ref}>
      <Line style={{ flexGrow: 1 }} variant={variant} size="300" />
      {children}
      <Line style={{ flexGrow: 1 }} variant={variant} size="300" />
    </Box>
  )
);

export const getLiveTimeline = (room: Room): EventTimeline =>
  room.getUnfilteredTimelineSet().getLiveTimeline();

export const getEventTimeline = (room: Room, eventId: string): EventTimeline | undefined => {
  const timelineSet = room.getUnfilteredTimelineSet();
  return timelineSet.getTimelineForEvent(eventId) ?? undefined;
};

export const getFirstLinkedTimeline = (
  timeline: EventTimeline,
  direction: Direction
): EventTimeline => {
  const linkedTm = timeline.getNeighbouringTimeline(direction);
  if (!linkedTm) return timeline;
  return getFirstLinkedTimeline(linkedTm, direction);
};

export const getLinkedTimelines = (timeline: EventTimeline): EventTimeline[] => {
  const firstTimeline = getFirstLinkedTimeline(timeline, Direction.Backward);
  const timelines: EventTimeline[] = [];

  for (
    let nextTimeline: EventTimeline | null = firstTimeline;
    nextTimeline;
    nextTimeline = nextTimeline.getNeighbouringTimeline(Direction.Forward)
  ) {
    timelines.push(nextTimeline);
  }
  return timelines;
};

export const timelineToEventsCount = (t: EventTimeline) => t.getEvents().length;
export const getTimelinesEventsCount = (timelines: EventTimeline[]): number => {
  const timelineEventCountReducer = (count: number, tm: EventTimeline) =>
    count + timelineToEventsCount(tm);
  return timelines.reduce(timelineEventCountReducer, 0);
};

export const getTimelineAndBaseIndex = (
  timelines: EventTimeline[],
  index: number
): [EventTimeline | undefined, number] => {
  let uptoTimelineLen = 0;
  const timeline = timelines.find((t) => {
    uptoTimelineLen += t.getEvents().length;
    if (index < uptoTimelineLen) return true;
    return false;
  });
  if (!timeline) return [undefined, 0];
  return [timeline, uptoTimelineLen - timeline.getEvents().length];
};

export const getTimelineRelativeIndex = (absoluteIndex: number, timelineBaseIndex: number) =>
  absoluteIndex - timelineBaseIndex;

export const getTimelineEvent = (timeline: EventTimeline, index: number): MatrixEvent | undefined =>
  timeline.getEvents()[index];

export const getEventIdAbsoluteIndex = (
  timelines: EventTimeline[],
  eventTimeline: EventTimeline,
  eventId: string
): number | undefined => {
  const timelineIndex = timelines.findIndex((t) => t === eventTimeline);
  if (timelineIndex === -1) return undefined;
  const eventIndex = eventTimeline.getEvents().findIndex((evt) => evt.getId() === eventId);
  if (eventIndex === -1) return undefined;
  const baseIndex = timelines
    .slice(0, timelineIndex)
    .reduce((accValue, timeline) => timeline.getEvents().length + accValue, 0);
  return baseIndex + eventIndex;
};

type RoomTimelineProps = {
  room: Room;
  eventId?: string;
  roomInputRef: RefObject<HTMLElement>;
  alternateInputRef: RefObject<HTMLDivElement>;
  editor: Editor;
};

const PAGINATION_LIMIT = 80;

type TimelineRange = {
  oldest: number;
  newest: number;
};

type Timeline = {
  linkedTimelines: EventTimeline[];
  range: TimelineRange;
};

const useEventTimelineLoader = (
  mx: MatrixClient,
  room: Room,
  onLoad: (eventId: string, linkedTimelines: EventTimeline[], evtAbsIndex: number) => void,
  onError: (err: Error | null) => void
) => {
  const loadEventTimeline = useCallback(
    async (eventId: string) => {
      const [err, replyEvtTimeline] = await to(
        mx.getEventTimeline(room.getUnfilteredTimelineSet(), eventId)
      );
      if (!replyEvtTimeline) {
        onError(err ?? null);
        return;
      }
      const linkedTimelines = getLinkedTimelines(replyEvtTimeline);
      const absIndex = getEventIdAbsoluteIndex(linkedTimelines, replyEvtTimeline, eventId);

      if (absIndex === undefined) {
        onError(err ?? null);
        return;
      }

      if (room.hasEncryptionStateEvent()) {
        await to(decryptAllTimelineEvent(mx, replyEvtTimeline));
      }

      onLoad(eventId, linkedTimelines, absIndex);
    },
    [mx, room, onLoad, onError]
  );

  return loadEventTimeline;
};

const useTimelinePagination = (
  mx: MatrixClient,
  timeline: Timeline,
  setTimeline: Dispatch<SetStateAction<Timeline>>,
  limit: number,
  onFetchStateChange?: (backwards: boolean, fetching: boolean) => void
) => {
  const timelineRef = useRef(timeline);
  timelineRef.current = timeline;
  const onFetchStateChangeRef = useRef(onFetchStateChange);
  onFetchStateChangeRef.current = onFetchStateChange;
  const alive = useAlive();

  const handleTimelinePagination = useMemo(() => {
    let fetching = false;

    const recalibratePagination = (
      linkedTimelines: EventTimeline[],
      timelinesEventsCount: number[],
      backwards: boolean
    ) => {
      const topTimeline = linkedTimelines[0];
      const timelineMatch = (mt: EventTimeline) => (t: EventTimeline) => t === mt;

      const newLTimelines = getLinkedTimelines(topTimeline);
      const topTmIndex = newLTimelines.findIndex(timelineMatch(topTimeline));
      const topAddedTm = topTmIndex === -1 ? [] : newLTimelines.slice(0, topTmIndex);

      const topTmAddedEvt =
        timelineToEventsCount(newLTimelines[topTmIndex]) - timelinesEventsCount[0];
      const offsetRange = getTimelinesEventsCount(topAddedTm) + (backwards ? topTmAddedEvt : 0);

      setTimeline((currentTimeline) => ({
        linkedTimelines: newLTimelines,
        range:
          offsetRange > 0
            ? {
                oldest: currentTimeline.range.oldest + offsetRange,
                newest: currentTimeline.range.newest + offsetRange,
              }
            : { ...currentTimeline.range },
      }));
    };

    return async (backwards: boolean) => {
      if (fetching) return;
      const { linkedTimelines: lTimelines } = timelineRef.current;
      const timelinesEventsCount = lTimelines.map(timelineToEventsCount);

      const timelineToPaginate = backwards ? lTimelines[0] : lTimelines[lTimelines.length - 1];
      if (!timelineToPaginate) return;

      const paginationToken = timelineToPaginate.getPaginationToken(
        backwards ? Direction.Backward : Direction.Forward
      );
      if (
        !paginationToken &&
        getTimelinesEventsCount(lTimelines) !==
          getTimelinesEventsCount(getLinkedTimelines(timelineToPaginate))
      ) {
        recalibratePagination(lTimelines, timelinesEventsCount, backwards);
        return;
      }
      if (!paginationToken) return;

      fetching = true;
      onFetchStateChangeRef.current?.(backwards, true);
      const [err] = await to(
        mx.paginateEventTimeline(timelineToPaginate, {
          backwards,
          limit,
        })
      );
      if (err) {
        fetching = false;
        onFetchStateChangeRef.current?.(backwards, false);
        return;
      }
      const fetchedTimeline =
        timelineToPaginate.getNeighbouringTimeline(
          backwards ? Direction.Backward : Direction.Forward
        ) ?? timelineToPaginate;
      // Decrypt all event ahead of render cycle
      const roomId = fetchedTimeline.getRoomId();
      const room = roomId ? mx.getRoom(roomId) : null;

      if (room?.hasEncryptionStateEvent()) {
        await to(decryptAllTimelineEvent(mx, fetchedTimeline));
      }

      fetching = false;
      onFetchStateChangeRef.current?.(backwards, false);
      if (alive()) {
        recalibratePagination(lTimelines, timelinesEventsCount, backwards);
      }
    };
  }, [mx, alive, setTimeline, limit]);
  return handleTimelinePagination;
};

const useLiveEventArrive = (room: Room, onArrive: (mEvent: MatrixEvent) => void) => {
  useEffect(() => {
    const handleTimelineEvent: EventTimelineSetHandlerMap[RoomEvent.Timeline] = (
      mEvent,
      eventRoom,
      toStartOfTimeline,
      removed,
      data
    ) => {
      if (eventRoom?.roomId !== room.roomId || !data.liveEvent) return;
      onArrive(mEvent);
    };
    const handleRedaction: RoomEventHandlerMap[RoomEvent.Redaction] = (mEvent, eventRoom) => {
      if (eventRoom?.roomId !== room.roomId) return;
      onArrive(mEvent);
    };

    room.on(RoomEvent.Timeline, handleTimelineEvent);
    room.on(RoomEvent.Redaction, handleRedaction);
    return () => {
      room.removeListener(RoomEvent.Timeline, handleTimelineEvent);
      room.removeListener(RoomEvent.Redaction, handleRedaction);
    };
  }, [room, onArrive]);
};

const useLiveTimelineRefresh = (room: Room, onRefresh: () => void) => {
  useEffect(() => {
    const handleTimelineRefresh: RoomEventHandlerMap[RoomEvent.TimelineRefresh] = (r) => {
      if (r.roomId !== room.roomId) return;
      onRefresh();
    };

    room.on(RoomEvent.TimelineRefresh, handleTimelineRefresh);
    return () => {
      room.removeListener(RoomEvent.TimelineRefresh, handleTimelineRefresh);
    };
  }, [room, onRefresh]);
};

const getInitialTimeline = (room: Room) => {
  const linkedTimelines = getLinkedTimelines(getLiveTimeline(room));
  const evLength = getTimelinesEventsCount(linkedTimelines);
  return {
    linkedTimelines,
    range: {
      oldest: Math.max(evLength - PAGINATION_LIMIT, 0),
      newest: evLength,
    },
  };
};

const getEmptyTimeline = () => ({
  range: { oldest: 0, newest: 0 },
  linkedTimelines: [],
});

const getRoomUnreadInfo = (room: Room, scrollTo = false) => {
  const readUptoEventId = room.getEventReadUpTo(room.client.getUserId() ?? '');
  if (!readUptoEventId) return undefined;
  const evtTimeline = getEventTimeline(room, readUptoEventId);
  const latestTimeline = evtTimeline && getFirstLinkedTimeline(evtTimeline, Direction.Forward);
  return {
    readUptoEventId,
    inLiveTimeline: latestTimeline === room.getLiveTimeline(),
    scrollTo,
  };
};

export function RoomTimeline({
  room,
  eventId,
  roomInputRef,
  alternateInputRef,
  editor,
}: RoomTimelineProps) {
  const mx = useMatrixClient();
  const useAuthentication = useMediaAuthentication();
  const [hideActivity] = useSetting(settingsAtom, 'hideActivity');
  const [messageLayout] = useSetting(settingsAtom, 'messageLayout');
  const [messageSpacing] = useSetting(settingsAtom, 'messageSpacing');
  const [legacyUsernameColor] = useSetting(settingsAtom, 'legacyUsernameColor');
  const direct = useIsDirectRoom();
  const [hideMembershipEvents] = useSetting(settingsAtom, 'hideMembershipEvents');
  const [hideNickAvatarEvents] = useSetting(settingsAtom, 'hideNickAvatarEvents');
  const [mediaAutoLoad] = useSetting(settingsAtom, 'mediaAutoLoad');
  const [urlPreview] = useSetting(settingsAtom, 'urlPreview');
  const [encUrlPreview] = useSetting(settingsAtom, 'encUrlPreview');
  const showUrlPreview = room.hasEncryptionStateEvent() ? encUrlPreview : urlPreview;
  const [showHiddenEvents] = useSetting(settingsAtom, 'showHiddenEvents');
  const [unfocusedAutoScroll] = useSetting(settingsAtom, 'unfocusedAutoScroll');
  const [showDeveloperTools] = useSetting(settingsAtom, 'developerTools');
  const [replyHighlight] = useSetting(settingsAtom, 'replyHighlight');

  const [hour24Clock] = useSetting(settingsAtom, 'hour24Clock');
  const [dateFormatString] = useSetting(settingsAtom, 'dateFormatString');
  const [alternateInput] = useSetting(settingsAtom, 'alternateInput');
  const [pauseGifs] = useSetting(settingsAtom, 'pauseGifs');

  const ignoredUsersList = useIgnoredUsers();
  const ignoredUsersSet = useMemo(() => new Set(ignoredUsersList), [ignoredUsersList]);

  const setReplyDraft = useSetAtom(roomIdToReplyDraftAtomFamily(room.roomId));
  const setSliderPosition = useSetAtom(timelineSliderPositionAtom);
  const sliderVisible = useAtomValue(timelineSliderVisibleAtom);
  const powerLevels = usePowerLevelsContext();
  const creators = useRoomCreators(room);

  const creatorsTag = useRoomCreatorsTag();
  const powerLevelTags = usePowerLevelTags(room, powerLevels);
  const getMemberPowerTag = useGetMemberPowerTag(room, creators, powerLevels);

  const theme = useTheme();
  const accessiblePowerTagColors = useAccessiblePowerTagColors(
    theme.kind,
    creatorsTag,
    powerLevelTags,
    true
  );

  const permissions = useRoomPermissions(creators, powerLevels);

  const canRedact = permissions.action('redact', mx.getSafeUserId());
  const canSendReaction = permissions.event(MessageEvent.Reaction, mx.getSafeUserId());
  const canPinEvent = permissions.stateEvent(StateEvent.RoomPinnedEvents, mx.getSafeUserId());
  const [editId, setEditId] = useState<string>();

  const roomToParents = useAtomValue(roomToParentsAtom);
  const unread = useRoomUnread(room.roomId, roomToUnreadAtom);
  const { navigateRoom } = useRoomNavigate();
  const mentionClickHandler = useMentionClickHandler(room.roomId);
  const spoilerClickHandler = useSpoilerClickHandler();
  const openUserRoomProfile = useOpenUserRoomProfile();
  const space = useSpaceOptionally();

  const imagePackRooms: Room[] = useImagePackRooms(room.roomId, roomToParents);

  const [unreadInfo, setUnreadInfo] = useState(() => getRoomUnreadInfo(room, true));
  const readUptoEventIdRef = useRef<string>();
  readUptoEventIdRef.current = unreadInfo?.readUptoEventId;

  const atBottomAnchorRef = useRef<HTMLElement>(null);
  const willScrollToReadMarker = !!(unreadInfo?.inLiveTimeline && unreadInfo?.scrollTo);
  const [atBottom, setAtBottom] = useState<boolean>(!willScrollToReadMarker);
  const atBottomRef = useRef(!willScrollToReadMarker);

  const scrollRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const scrollToBottomRef = useRef({
    count: 0,
    smooth: true,
  });

  const [focusItem, setFocusItem] = useState<
    | {
        index: number;
        eventId: string;
        scrollTo: boolean;
        highlight: boolean;
      }
    | undefined
  >();
  const alive = useAlive();

  const linkifyOpts = useMemo<LinkifyOpts>(
    () => ({
      ...LINKIFY_OPTS,
      render: factoryRenderLinkifyWithMention((href) =>
        renderMatrixMention(mx, room.roomId, href, makeMentionCustomProps(mentionClickHandler))
      ),
    }),
    [mx, room, mentionClickHandler]
  );
  const htmlReactParserOptions = useMemo<HTMLReactParserOptions>(
    () =>
      getReactCustomHtmlParser(mx, room.roomId, {
        linkifyOpts,
        useAuthentication,
        handleSpoilerClick: spoilerClickHandler,
        handleMentionClick: mentionClickHandler,
        pauseGifs,
      }),
    [mx, room, linkifyOpts, spoilerClickHandler, mentionClickHandler, useAuthentication, pauseGifs]
  );
  const [timeline, setTimeline] = useState<Timeline>(() =>
    eventId ? getEmptyTimeline() : getInitialTimeline(room)
  );
  const eventsLength = getTimelinesEventsCount(timeline.linkedTimelines);
  const liveTimelineLinked =
    timeline.linkedTimelines[timeline.linkedTimelines.length - 1] === getLiveTimeline(room);
  const canPaginateBack =
    typeof timeline.linkedTimelines[0]?.getPaginationToken(Direction.Backward) === 'string';
  const rangeAtOldest = timeline.range.oldest === 0;
  // True when no renderable events exist beyond the range.  Invisible events
  // (reactions, edits, redactions) that land past range.newest don't count.
  const rangeAtNewest = (() => {
    if (timeline.range.newest >= eventsLength) return true;
    for (let i = timeline.range.newest; i < eventsLength; i++) {
      const [tl, base] = getTimelineAndBaseIndex(timeline.linkedTimelines, i);
      if (!tl) continue;
      const evt = getTimelineEvent(tl, getTimelineRelativeIndex(i, base));
      if (evt && !reactionOrEditEvent(evt) && !evt.isRedaction()) return false;
    }
    return true;
  })();
  const atLiveEndRef = useRef(liveTimelineLinked && rangeAtNewest);
  atLiveEndRef.current = liveTimelineLinked && rangeAtNewest;

  // Ref so that stable callbacks (handleOpenEvent, handleDecryptRetry) can
  // always read the current linked timelines without being in their deps.
  const linkedTimelinesRef = useRef(timeline.linkedTimelines);
  linkedTimelinesRef.current = timeline.linkedTimelines;

  const [isForwardPaginating, setIsForwardPaginating] = useState(false);
  const handleTimelinePagination = useTimelinePagination(
    mx,
    timeline,
    setTimeline,
    PAGINATION_LIMIT,
    useCallback((backwards: boolean, fetching: boolean) => {
      if (!backwards) setIsForwardPaginating(fetching);
    }, [])
  );

  const getScrollElement = useCallback(() => scrollRef.current, []);

  const { getItems, scrollToItem, scrollToElement, observeBackAnchor, observeFrontAnchor } =
    useVirtualPaginator({
      count: eventsLength,
      limit: PAGINATION_LIMIT,
      range: { start: timeline.range.oldest, end: timeline.range.newest },
      onRangeChange: useCallback(
        (r) => setTimeline((cs) => ({ ...cs, range: { oldest: r.start, newest: r.end } })),
        []
      ),
      getScrollElement,
      getItemElement: useCallback(
        (index: number) =>
          (scrollRef.current?.querySelector(`[data-message-item="${index}"]`) as HTMLElement) ??
          undefined,
        []
      ),
      onEnd: handleTimelinePagination,
    });

  const loadEventTimeline = useEventTimelineLoader(
    mx,
    room,
    useCallback(
      (evtId, lTimelines, evtAbsIndex) => {
        if (!alive()) return;
        const evLength = getTimelinesEventsCount(lTimelines);

        // Batch both updates together so React commits them in one render pass.
        // useLayoutEffect fires after that single commit — elements are in the
        // DOM and we can scroll before any paint, eliminating the flash of the
        // unscrolled position.
        setTimeline({
          linkedTimelines: lTimelines,
          range: {
            oldest: Math.max(evtAbsIndex - PAGINATION_LIMIT, 0),
            newest: Math.min(evtAbsIndex + PAGINATION_LIMIT, evLength),
          },
        });
        setFocusItem({
          index: evtAbsIndex,
          eventId: evtId,
          scrollTo: true,
          highlight: evtId !== readUptoEventIdRef.current,
        });
      },
      [alive]
    ),
    useCallback(() => {
      if (!alive()) return;
      setTimeline(getInitialTimeline(room));
      scrollToBottomRef.current.count += 1;
      scrollToBottomRef.current.smooth = false;
      setSliderPosition(1);
    }, [alive, room, setSliderPosition])
  );

  useLiveEventArrive(
    room,
    useCallback(
      (mEvt: MatrixEvent) => {
        // Invisible events (reactions, edits, redactions) produce no visible
        // output. Shifting the range window for them drops an item from the top
        // of the rendered list without adding anything at the bottom, causing
        // images to unmount and messages to jump upward. Skip the range shift
        // for these events; a plain re-render is enough to update relation data.
        const isInvisible = reactionOrEditEvent(mEvt) || mEvt.isRedaction();

        if (atBottomRef.current) {
          if (!isInvisible) {
            if (document.hasFocus() && (!unreadInfo || mEvt.getSender() === mx.getUserId())) {
              const evtRoomId = mEvt.getRoomId();
              if (evtRoomId) {
                requestAnimationFrame(() => markAsRead(mx, evtRoomId, hideActivity));
              }
            }

            if (!document.hasFocus() && !unreadInfo) {
              setUnreadInfo(getRoomUnreadInfo(room));
            }

            if (!document.hasFocus() && !unfocusedAutoScroll) {
              setTimeline((ct) => ({
                ...ct,
                range: {
                  oldest: ct.range.oldest + 1,
                  newest: ct.range.newest + 1,
                },
              }));
              return;
            }

            scrollToBottomRef.current.count += 1;
            scrollToBottomRef.current.smooth = document.hasFocus();

            setTimeline((ct) => ({
              ...ct,
              range: {
                oldest: ct.range.oldest + 1,
                newest: ct.range.newest + 1,
              },
            }));
            return;
          }

          setTimeline((ct) => ({ ...ct }));
          return;
        }
        setTimeline((ct) => ({ ...ct }));
        if (!unreadInfo) {
          setUnreadInfo(getRoomUnreadInfo(room));
        }
      },
      [mx, room, unreadInfo, hideActivity, unfocusedAutoScroll]
    )
  );

  // Re-render when a local echo status changes (QUEUED → SENDING → sent / NOT_SENT).
  // RoomEvent.Timeline only fires for new events, so echoes updating in-place are missed.
  useEffect(() => {
    const handleLocalEchoUpdated: RoomEventHandlerMap[RoomEvent.LocalEchoUpdated] = (
      _mEvent,
      eventRoom
    ) => {
      if (eventRoom?.roomId !== room.roomId) return;
      setTimeline((ct) => ({ ...ct }));
    };
    room.on(RoomEvent.LocalEchoUpdated, handleLocalEchoUpdated);
    return () => {
      room.off(RoomEvent.LocalEchoUpdated, handleLocalEchoUpdated);
    };
  }, [room, setTimeline]);

  const handleOpenEvent = useCallback(
    async (
      evtId: string,
      highlight = true,
      onScroll: ((scrolled: boolean) => void) | undefined = undefined
    ) => {
      // Immediately mark as not at bottom to prevent auto-scroll-to-bottom
      // from firing during the smooth scroll animation (race with IntersectionObserver)
      atBottomRef.current = false;
      setAtBottom(false);

      const evtTimeline = getEventTimeline(room, evtId);
      const absoluteIndex =
        evtTimeline && getEventIdAbsoluteIndex(linkedTimelinesRef.current, evtTimeline, evtId);

      if (typeof absoluteIndex === 'number') {
        const scrolled = scrollToItem(absoluteIndex, {
          behavior: 'smooth',
          align: 'start',
          stopInView: true,
          offset: Math.round(window.innerHeight * 0.12),
        });
        if (onScroll) onScroll(scrolled);
        setFocusItem({
          index: absoluteIndex,
          eventId: evtId,
          scrollTo: false,
          highlight,
        });
      } else {
        setTimeline(getEmptyTimeline());
        loadEventTimeline(evtId);
      }
    },
    [room, scrollToItem, loadEventTimeline]
  );

  useLiveTimelineRefresh(
    room,
    useCallback(() => {
      if (liveTimelineLinked) {
        setTimeline(getInitialTimeline(room));
      }
    }, [room, liveTimelineLinked])
  );

  // Refresh timeline when returning from OS suspend or background tab
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.hidden) return;
      if (!atLiveEndRef.current) return;

      const freshTimelines = getLinkedTimelines(getLiveTimeline(room));
      const freshLength = getTimelinesEventsCount(freshTimelines);

      let updated = false;
      setTimeline((currentTimeline) => {
        const currentLength = getTimelinesEventsCount(currentTimeline.linkedTimelines);
        if (freshLength <= currentLength) return currentTimeline;

        updated = true;
        return {
          linkedTimelines: freshTimelines,
          range: {
            oldest: Math.max(freshLength - PAGINATION_LIMIT, 0),
            newest: freshLength,
          },
        };
      });

      if (updated) {
        scrollToBottomRef.current.count += 1;
        scrollToBottomRef.current.smooth = false;
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [room]);

  // Stay at bottom when message content grows (e.g. a tall image finishes loading)
  useResizeObserver(
    useMemo(() => {
      let mounted = false;
      return () => {
        if (!mounted) {
          mounted = true;
          return;
        }
        const scrollElement = getScrollElement();
        if (!scrollElement) return;
        if (atBottomRef.current) {
          scrollToBottom(scrollElement);
        }
      };
    }, [getScrollElement]),
    useCallback(() => contentRef.current, [])
  );

  // Stay at bottom when room editor resize
  useResizeObserver(
    useMemo(() => {
      let mounted = false;
      return (entries) => {
        if (!mounted) {
          // skip initial mounting call
          mounted = true;
          return;
        }
        if (!roomInputRef.current) return;
        const editorBaseEntry = getResizeObserverEntry(roomInputRef.current, entries);
        const scrollElement = getScrollElement();
        if (!editorBaseEntry || !scrollElement) return;

        if (atBottomRef.current) {
          scrollToBottom(scrollElement);
        }
      };
    }, [getScrollElement, roomInputRef]),
    useCallback(() => roomInputRef.current, [roomInputRef])
  );

  // Stay at bottom when the scroll container itself resizes (e.g. window resize, keyboard open)
  useResizeObserver(
    useMemo(() => {
      let mounted = false;
      return () => {
        if (!mounted) {
          mounted = true;
          return;
        }
        const scrollElement = getScrollElement();
        if (!scrollElement) return;
        if (atBottomRef.current) {
          scrollToBottom(scrollElement);
        }
      };
    }, [getScrollElement]),
    useCallback(() => scrollRef.current, [])
  );

  const tryAutoMarkAsRead = useCallback(() => {
    const readUptoEventId = readUptoEventIdRef.current;
    if (!readUptoEventId) {
      requestAnimationFrame(() => markAsRead(mx, room.roomId, hideActivity));
      return;
    }
    const evtTimeline = getEventTimeline(room, readUptoEventId);
    const latestTimeline = evtTimeline && getFirstLinkedTimeline(evtTimeline, Direction.Forward);
    if (latestTimeline === room.getLiveTimeline()) {
      requestAnimationFrame(() => markAsRead(mx, room.roomId, hideActivity));
    }
  }, [mx, room, hideActivity]);

  useIntersectionObserver(
    useCallback(
      (entries) => {
        const target = atBottomAnchorRef.current;
        if (!target) return;
        const targetEntry = getIntersectionObserverEntry(target, entries);
        if (!targetEntry) return;
        if (targetEntry.isIntersecting && atLiveEndRef.current) {
          atBottomRef.current = true;
          setAtBottom(true);
          if (document.hasFocus()) {
            tryAutoMarkAsRead();
          }
        } else if (!targetEntry.isIntersecting) {
          atBottomRef.current = false;
          setAtBottom(false);
        }
      },
      [tryAutoMarkAsRead]
    ),
    useCallback(
      () => ({
        root: getScrollElement(),
        rootMargin: '100px',
      }),
      [getScrollElement]
    ),
    useCallback(() => atBottomAnchorRef.current, [])
  );

  // Track whether the last message is visible at all (for hiding Jump to Latest)
  const [lastMsgVisible, setLastMsgVisible] = useState(true);
  useEffect(() => {
    const scrollEl = scrollRef.current;
    if (!scrollEl || !liveTimelineLinked || !rangeAtNewest) {
      setLastMsgVisible(false);
      return undefined;
    }

    const lastIndex = timeline.range.newest - 1;
    if (lastIndex < timeline.range.oldest) return undefined;
    const lastEl = scrollEl.querySelector(
      `[data-message-item="${lastIndex}"]`
    ) as HTMLElement | null;
    if (!lastEl) return undefined;

    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries.find((e) => e.target === lastEl);
        if (entry) {
          setLastMsgVisible(entry.isIntersecting);
        }
      },
      { root: scrollEl }
    );
    observer.observe(lastEl);
    return () => observer.disconnect();
  }, [
    timeline.range.newest,
    timeline.range.oldest,
    eventsLength,
    liveTimelineLinked,
    rangeAtNewest,
  ]);

  useDocumentFocusChange(
    useCallback(
      (inFocus) => {
        if (inFocus && atBottomRef.current) {
          if (!unfocusedAutoScroll && unreadInfo?.inLiveTimeline) {
            handleOpenEvent(unreadInfo.readUptoEventId, false, (scrolled) => {
              // the unread event is already in view
              // so, try mark as read;
              if (!scrolled) {
                tryAutoMarkAsRead();
              }
            });
            return;
          }
          tryAutoMarkAsRead();
        }
      },
      [tryAutoMarkAsRead, unreadInfo, handleOpenEvent, unfocusedAutoScroll]
    )
  );

  // Handle up arrow edit
  useKeyDown(
    window,
    useCallback(
      (evt) => {
        if (
          isKeyHotkey('arrowup', evt) &&
          editableActiveElement() &&
          document.activeElement?.getAttribute('data-editable-name') === ROOM_INPUT_EDITABLE_NAME &&
          isEmptyEditor(editor)
        ) {
          const editableEvt = getLatestEditableEvt(room.getLiveTimeline(), (mEvt) =>
            canEditEvent(mx, mEvt)
          );
          const editableEvtId = editableEvt?.getId();
          if (!editableEvtId) return;
          setEditId(editableEvtId);
          evt.preventDefault();
        }
      },
      [mx, room, editor]
    )
  );

  useEffect(() => {
    if (eventId) {
      atBottomRef.current = false;
      setAtBottom(false);
      setTimeline(getEmptyTimeline());
      loadEventTimeline(eventId);
    } else {
      setTimeline(getInitialTimeline(room));
      scrollToBottomRef.current.count += 1;
      scrollToBottomRef.current.smooth = false;
    }
  }, [eventId, loadEventTimeline, room]);

  useLayoutEffect(() => {
    const scrollEl = scrollRef.current;
    if (scrollEl) {
      scrollToBottom(scrollEl);
    }
  }, []);

  // if live timeline is linked and unreadInfo change
  // Scroll to last read message
  useLayoutEffect(() => {
    const { readUptoEventId, inLiveTimeline, scrollTo } = unreadInfo ?? {};
    if (readUptoEventId && inLiveTimeline && scrollTo) {
      const linkedTimelines = getLinkedTimelines(getLiveTimeline(room));
      const evtTimeline = getEventTimeline(room, readUptoEventId);
      const absoluteIndex =
        evtTimeline && getEventIdAbsoluteIndex(linkedTimelines, evtTimeline, readUptoEventId);
      if (absoluteIndex) {
        scrollToItem(absoluteIndex, {
          behavior: 'instant',
          align: 'start',
          stopInView: true,
        });
      }
    }
  }, [room, unreadInfo, scrollToItem]);

  // scroll to focused message
  // Look up by eventId so stale indices (from recalibratePagination) never land
  // on the wrong element. getBoundingClientRect gives the true current position
  // after all image containers have applied their aspect-ratio heights.
  useLayoutEffect(() => {
    if (!focusItem?.scrollTo) return;
    const scrollEl = scrollRef.current;
    if (!scrollEl) return;
    let el = scrollEl.querySelector(
      `[data-message-id="${focusItem.eventId}"]`
    ) as HTMLElement | null;
    if (!el) {
      // Target event is not rendered (e.g. reaction, edit, state event).
      // Find the nearest rendered item by index.
      const idx = focusItem.index;
      let nearest: HTMLElement | null = null;
      let bestDist = Infinity;
      scrollEl.querySelectorAll<HTMLElement>('[data-message-item]').forEach((candidate) => {
        const itemIdx = Number(candidate.getAttribute('data-message-item'));
        const dist = Math.abs(itemIdx - idx);
        if (dist < bestDist) {
          bestDist = dist;
          nearest = candidate;
        }
      });
      el = nearest;
    }
    if (!el) return;
    const topOffset = Math.round(window.innerHeight * 0.12);
    const newScrollTop =
      scrollEl.scrollTop +
      el.getBoundingClientRect().top -
      scrollEl.getBoundingClientRect().top -
      topOffset;
    scrollEl.scrollTo({ top: newScrollTop, behavior: 'instant' });
  }, [focusItem]);

  // clear focused message highlight after 2 s
  useEffect(() => {
    if (!focusItem) return undefined;
    const id = setTimeout(() => {
      if (!alive()) return;
      setFocusItem((currentItem) => {
        if (currentItem === focusItem) return undefined;
        return currentItem;
      });
    }, 2000);
    return () => clearTimeout(id);
  }, [alive, focusItem]);

  // scroll to bottom of timeline
  const scrollToBottomCount = scrollToBottomRef.current.count;
  useLayoutEffect(() => {
    if (scrollToBottomCount > 0) {
      const scrollEl = scrollRef.current;
      if (scrollEl)
        scrollToBottom(scrollEl, scrollToBottomRef.current.smooth ? 'smooth' : 'instant');
    }
  }, [scrollToBottomCount]);

  // Remove unreadInfo on mark as read
  useEffect(() => {
    if (!unread) {
      setUnreadInfo(undefined);
    }
  }, [unread]);

  // scroll out of view msg editor in view.
  useEffect(() => {
    if (editId) {
      const editMsgElement =
        (scrollRef.current?.querySelector(`[data-message-id="${editId}"]`) as HTMLElement) ??
        undefined;
      if (editMsgElement) {
        scrollToElement(editMsgElement, {
          align: 'center',
          behavior: 'smooth',
          stopInView: true,
        });
      }
    }
  }, [scrollToElement, editId]);

  const handleJumpToLatest = () => {
    if (eventId) {
      navigateRoom(room.roomId, undefined, { replace: true });
    }
    setTimeline(getInitialTimeline(room));
    scrollToBottomRef.current.count += 1;
    scrollToBottomRef.current.smooth = false;
    setSliderPosition(1);
  };

  const handleJumpToUnread = () => {
    if (unreadInfo?.readUptoEventId) {
      atBottomRef.current = false;
      setAtBottom(false);
      setTimeline(getEmptyTimeline());
      loadEventTimeline(unreadInfo.readUptoEventId);
    }
  };

  const handleMarkAsRead = () => {
    setUnreadInfo(undefined);
    markAsRead(mx, room.roomId, hideActivity);
  };

  const handleOpenReply: MouseEventHandler = useCallback(
    async (evt) => {
      const targetId = evt.currentTarget.getAttribute('data-event-id');
      if (!targetId) return;
      handleOpenEvent(targetId);
    },
    [handleOpenEvent]
  );

  const handleUserClick: MouseEventHandler<HTMLButtonElement> = useCallback(
    (evt) => {
      evt.preventDefault();
      evt.stopPropagation();
      const userId = evt.currentTarget.getAttribute('data-user-id');
      if (!userId) {
        console.warn('Button should have "data-user-id" attribute!');
        return;
      }
      openUserRoomProfile(
        room.roomId,
        space?.roomId,
        userId,
        evt.currentTarget.getBoundingClientRect()
      );
    },
    [room, space, openUserRoomProfile]
  );
  const handleUsernameClick: MouseEventHandler<HTMLButtonElement> = useCallback(
    (evt) => {
      evt.preventDefault();
      const userId = evt.currentTarget.getAttribute('data-user-id');
      if (!userId) {
        console.warn('Button should have "data-user-id" attribute!');
        return;
      }
      const name = getMemberDisplayName(room, userId) ?? getMxIdLocalPart(userId) ?? userId;
      if (alternateInput && editor.insertAlternateText) {
        editor.insertAlternateText(name.startsWith('@') ? name : `@${name}`);
      } else {
        editor.insertNode(
          createMentionElement(
            userId,
            name.startsWith('@') ? name : `@${name}`,
            userId === mx.getUserId()
          )
        );
        ReactEditor.focus(editor);
        moveCursor(editor);
      }
    },
    [mx, room, editor, alternateInput]
  );

  const handleReplyClick: MouseEventHandler<HTMLButtonElement> = useCallback(
    (evt, startThread = false) => {
      const replyId = evt.currentTarget.getAttribute('data-event-id');
      if (!replyId) {
        console.warn('Button should have "data-event-id" attribute!');
        return;
      }
      const replyEvt = room.findEventById(replyId);
      if (!replyEvt) return;
      const editedReply = getEditedEvent(replyId, replyEvt, room.getUnfilteredTimelineSet());
      const content: IContent = editedReply?.getContent()['m.new_content'] ?? replyEvt.getContent();
      const { body, formatted_body: formattedBody } = content;
      const { 'm.relates_to': relation } = startThread
        ? { 'm.relates_to': { rel_type: 'm.thread', event_id: replyId } }
        : replyEvt.getWireContent();
      const senderId = replyEvt.getSender();
      if (senderId && typeof body === 'string') {
        setReplyDraft({
          userId: senderId,
          eventId: replyId,
          body,
          formattedBody,
          relation,
        });
        setTimeout(() => {
          if (alternateInput) {
            alternateInputRef.current?.focus();
          } else {
            ReactEditor.focus(editor);
          }
        }, 100);
      }
    },
    [room, setReplyDraft, editor, alternateInput, alternateInputRef]
  );

  const handleReactionToggle = useCallback(
    (targetEventId: string, key: string, shortcode?: string) => {
      const relations = getEventReactions(room.getUnfilteredTimelineSet(), targetEventId);
      const allReactions = relations?.getSortedAnnotationsByKey() ?? [];
      const [, reactionsSet] = allReactions.find(([k]) => k === key) ?? [];
      const reactions: MatrixEvent[] = reactionsSet ? Array.from(reactionsSet) : [];
      const myReaction = reactions.find(factoryEventSentBy(mx.getSafeUserId()));

      if (myReaction && !!myReaction?.isRelation()) {
        const myReactionId = myReaction.getId();
        if (myReactionId) {
          mx.redactEvent(room.roomId, myReactionId);
        }
        return;
      }
      const rShortcode =
        shortcode ||
        (reactions.find(eventWithShortcode)?.getContent().shortcode as string | undefined);
      mx.sendEvent(
        room.roomId,
        EventType.Reaction,
        getReactionContent(targetEventId, key, rShortcode)
      );
    },
    [mx, room]
  );
  const handleEdit = useCallback(
    (editEvtId?: string) => {
      if (editEvtId) {
        setEditId(editEvtId);
        return;
      }
      setEditId(undefined);
      if (alternateInput) {
        alternateInputRef.current?.focus();
      } else {
        ReactEditor.focus(editor);
      }
    },
    [editor, alternateInput, alternateInputRef]
  );

  const handleDecryptRetry = useCallback(async () => {
    await Promise.allSettled(
      linkedTimelinesRef.current.map((tl) => decryptAllTimelineEvent(mx, tl))
    );
  }, [mx]);

  // ─── Bulk selection / deletion ───
  const [selectionMode, setSelectionMode] = useAtom(selectionModeAtom);
  const [selectedIds, setSelectedIds] = useAtom(selectedIdsAtom);
  const [bulkDeleting, setBulkDeleting] = useState(false);

  const handleBulkDelete = useCallback(async () => {
    const ids = Array.from(selectedIds);
    if (ids.length === 0) return;
    setBulkDeleting(true);
    await Promise.allSettled(ids.map((evtId) => mx.redactEvent(room.roomId, evtId)));
    setBulkDeleting(false);
    setSelectedIds(new Set());
    setSelectionMode(false);
  }, [mx, room, selectedIds, setSelectedIds, setSelectionMode]);

  const handleCancelSelection = useCallback(() => {
    setSelectedIds(new Set());
    setSelectionMode(false);
  }, [setSelectedIds, setSelectionMode]);

  // Exit selection mode on Escape
  useKeyDown(
    window,
    useCallback(
      (evt: KeyboardEvent) => {
        if (evt.key === 'Escape' && selectionMode) {
          handleCancelSelection();
        }
      },
      [selectionMode, handleCancelSelection]
    )
  );

  // Clear selection on room change
  useEffect(
    () => () => {
      setSelectedIds(new Set());
      setSelectionMode(false);
    },
    [room.roomId, setSelectedIds, setSelectionMode]
  );

  const buildTimelineItems = () => {
    const events: Parameters<typeof buildTimelineDescriptors>[0] = [];

    for (const item of getItems()) {
      const [eventTimeline, baseIndex] = getTimelineAndBaseIndex(timeline.linkedTimelines, item);
      if (!eventTimeline) continue;
      const timelineSet = eventTimeline.getTimelineSet();
      const mEvent = getTimelineEvent(eventTimeline, getTimelineRelativeIndex(item, baseIndex));
      const mEventId = mEvent?.getId();

      if (!mEvent || !mEventId) continue;

      const eventSender = mEvent.getSender();
      if (eventSender && ignoredUsersSet.has(eventSender)) continue;
      if (mEvent.isRedacted() && !showHiddenEvents) continue;

      events.push({ mEvent, mEventId, timelineSet, item });
    }

    const willEventRender = (mEvent: MatrixEvent): boolean => {
      if (reactionOrEditEvent(mEvent)) return false;
      if (!showHiddenEvents) {
        if (mEvent.isRedaction()) return false;
        const type = mEvent.getType();
        const isRegistered =
          type === MessageEvent.RoomMessage ||
          type === MessageEvent.RoomMessageEncrypted ||
          type === MessageEvent.Sticker ||
          type === MessageEvent.PollStart ||
          type === 'm.poll.start' ||
          type === StateEvent.RoomMember ||
          type === StateEvent.RoomName ||
          type === StateEvent.RoomTopic ||
          type === StateEvent.RoomAvatar;
        if (!isRegistered) return false;
      }
      if (mEvent.getType() === StateEvent.RoomMember) {
        const membershipChanged = isMembershipChanged(mEvent);
        if (membershipChanged && hideMembershipEvents) return false;
        if (!membershipChanged && hideNickAvatarEvents) return false;
      }
      return true;
    };

    return buildTimelineDescriptors(
      events,
      readUptoEventIdRef.current ?? undefined,
      mx.getSafeUserId(),
      willEventRender
    );
  };

  const timelineItems = buildTimelineItems();

  const contextValue = useMemo(
    () => ({
      room,
      mx,
      messageLayout,
      messageSpacing,
      mediaAutoLoad,
      showUrlPreview,
      canRedact,
      canSendReaction,
      canPinEvent,
      imagePackRooms,
      getMemberPowerTag,
      accessiblePowerTagColors,
      legacyUsernameColor,
      direct,
      hideReadReceipts: hideActivity,
      showDeveloperTools,
      hour24Clock,
      dateFormatString,
      htmlReactParserOptions,
      linkifyOpts,
      replyHighlight,
      showHiddenEvents,
      hideMembershipEvents,
      hideNickAvatarEvents,
      handleUserClick,
      handleUsernameClick,
      handleReplyClick,
      handleReactionToggle,
      editId,
      handleEdit,
      handleOpenReply,
      handleDecryptRetry,
    }),
    [
      room,
      mx,
      messageLayout,
      messageSpacing,
      mediaAutoLoad,
      showUrlPreview,
      canRedact,
      canSendReaction,
      canPinEvent,
      imagePackRooms,
      getMemberPowerTag,
      accessiblePowerTagColors,
      legacyUsernameColor,
      direct,
      hideActivity,
      showDeveloperTools,
      hour24Clock,
      dateFormatString,
      htmlReactParserOptions,
      linkifyOpts,
      replyHighlight,
      showHiddenEvents,
      hideMembershipEvents,
      hideNickAvatarEvents,
      handleUserClick,
      handleUsernameClick,
      handleReplyClick,
      handleReactionToggle,
      editId,
      handleEdit,
      handleOpenReply,
      handleDecryptRetry,
    ]
  );

  return (
    <TimelineMessageContext.Provider value={contextValue}>
      <Box grow="Yes" style={{ position: 'relative' }}>
        {unreadInfo?.readUptoEventId && !unreadInfo?.inLiveTimeline && (
          <TimelineFloat position="Top">
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
          </TimelineFloat>
        )}
        <Scroll ref={scrollRef} visibility="Hover" style={{ overscrollBehavior: 'none' }}>
          <Box
            ref={contentRef}
            direction="Column"
            justifyContent="End"
            style={{
              minHeight: '100%',
              padding: `${config.space.S600} ${sliderVisible ? toRem(48) : '0'} ${
                config.space.S600
              } 0`,
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
            {(canPaginateBack || !rangeAtOldest) &&
              (messageLayout === MessageLayout.Compact ? (
                <>
                  <MessageBase>
                    <CompactPlaceholder key={getItems().length} />
                  </MessageBase>
                  <MessageBase>
                    <CompactPlaceholder key={getItems().length} />
                  </MessageBase>
                  <MessageBase>
                    <CompactPlaceholder key={getItems().length} />
                  </MessageBase>
                  <MessageBase>
                    <CompactPlaceholder key={getItems().length} />
                  </MessageBase>
                  <MessageBase ref={observeBackAnchor}>
                    <CompactPlaceholder key={getItems().length} />
                  </MessageBase>
                </>
              ) : (
                <>
                  <MessageBase>
                    <DefaultPlaceholder key={getItems().length} />
                  </MessageBase>
                  <MessageBase>
                    <DefaultPlaceholder key={getItems().length} />
                  </MessageBase>
                  <MessageBase ref={observeBackAnchor}>
                    <DefaultPlaceholder key={getItems().length} />
                  </MessageBase>
                </>
              ))}

            {timelineItems.map((d) => {
              if (d.type === 'new-messages') {
                return (
                  <MessageBase key={d.key} space={messageSpacing}>
                    <TimelineDivider style={{ color: color.Success.Main }} variant="Inherit">
                      <Badge as="span" size="500" variant="Success" fill="Solid" radii="300">
                        <Text size="L400">New Messages</Text>
                      </Badge>
                    </TimelineDivider>
                  </MessageBase>
                );
              }
              if (d.type === 'day-divider') {
                return (
                  <MessageBase key={d.key} space={messageSpacing}>
                    <TimelineDivider variant="Surface">
                      <Badge as="span" size="500" variant="Secondary" fill="None" radii="300">
                        <Text size="L400">
                          {(() => {
                            if (today(d.ts)) return 'Today';
                            if (yesterday(d.ts)) return 'Yesterday';
                            return timeDayMonthYear(d.ts);
                          })()}
                        </Text>
                      </Badge>
                    </TimelineDivider>
                  </MessageBase>
                );
              }
              const { replyEventId } = d.mEvent;
              // Use room.findEventById (broader — searches all timelineSets in
              // the room) instead of d.timelineSet.findEventById (limited to
              // one timelineSet). The Reply component does the same fallback,
              // which is why the quoted preview can render even when the
              // narrow lookup fails.
              const replyToMe =
                !!replyEventId &&
                room.findEventById(replyEventId)?.getSender() === mx.getSafeUserId();
              return (
                <MemoizedTimelineEvent
                  key={d.mEventId}
                  mEvent={d.mEvent}
                  mEventId={d.mEventId}
                  timelineSet={d.timelineSet}
                  item={d.item}
                  collapsed={d.collapsed}
                  groupedImages={d.groupedImages}
                  isHighlighted={focusItem?.eventId === d.mEventId && !!focusItem.highlight}
                  isEditing={editId === d.mEventId}
                  reactionRelations={getEventReactions(d.timelineSet, d.mEventId)}
                  editedEvent={getEditedEvent(d.mEventId, d.mEvent, d.timelineSet)}
                  isRedacted={d.mEvent.isRedacted()}
                  eventStatus={d.mEvent.status}
                  replyToMe={replyToMe}
                />
              );
            })}

            {/* Forward pagination anchor — only rendered when there's more content ahead.
              Removed at the live end so the IntersectionObserver doesn't fire
              continuously (which caused forward/backward pagination to fight). */}
            {(!liveTimelineLinked || !rangeAtNewest) && <div ref={observeFrontAnchor} />}
            {/* Visual skeletons — only shown while the server fetch is in-flight. */}
            {isForwardPaginating &&
              (messageLayout === MessageLayout.Compact ? (
                <>
                  <MessageBase>
                    <CompactPlaceholder key={getItems().length} />
                  </MessageBase>
                  <MessageBase>
                    <CompactPlaceholder key={getItems().length} />
                  </MessageBase>
                  <MessageBase>
                    <CompactPlaceholder key={getItems().length} />
                  </MessageBase>
                  <MessageBase>
                    <CompactPlaceholder key={getItems().length} />
                  </MessageBase>
                  <MessageBase>
                    <CompactPlaceholder key={getItems().length} />
                  </MessageBase>
                </>
              ) : (
                <>
                  <MessageBase>
                    <DefaultPlaceholder key={getItems().length} />
                  </MessageBase>
                  <MessageBase>
                    <DefaultPlaceholder key={getItems().length} />
                  </MessageBase>
                  <MessageBase>
                    <DefaultPlaceholder key={getItems().length} />
                  </MessageBase>
                </>
              ))}
            <span ref={atBottomAnchorRef} />
          </Box>
        </Scroll>
        <TimelineFloat
          className={css.JumpToLatestFloat}
          position="Bottom"
          data-visible={!atBottom && !lastMsgVisible}
        >
          <Chip
            variant="SurfaceVariant"
            radii="Pill"
            outlined
            before={<Icon size="50" src={Icons.ArrowBottom} />}
            onClick={handleJumpToLatest}
          >
            <Text size="L400">Jump to Latest</Text>
          </Chip>
        </TimelineFloat>
        {selectionMode && (
          <TimelineFloat position="Bottom">
            <SelectionActionBar
              selectedCount={selectedIds.size}
              onDelete={handleBulkDelete}
              onCancel={handleCancelSelection}
              deleting={bulkDeleting}
            />
          </TimelineFloat>
        )}
      </Box>
    </TimelineMessageContext.Provider>
  );
}
