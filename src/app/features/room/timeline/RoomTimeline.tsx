import type { MouseEventHandler, RefObject } from 'react';
import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import type { MatrixEvent, Room, RoomEventHandlerMap } from 'matrix-js-sdk';
import { Direction, RoomEvent } from 'matrix-js-sdk';
import type { HTMLReactParserOptions } from 'html-react-parser';
import { useAtomValue, useSetAtom } from 'jotai';
import type { ContainerColor } from 'folds';
import { Badge, Box, Chip, Icon, Icons, Line, Scroll, Text, as, color, config, toRem } from 'folds';
import type { Opts as LinkifyOpts } from 'linkifyjs';
import { useMatrixClient } from '../../../hooks/useMatrixClient';
import { useVirtualPaginator } from '../../../hooks/useVirtualPaginator';
import { useAlive } from '../../../hooks/useAlive';
import {
  PAGINATION_LIMIT,
  getEmptyTimeline,
  getInitialTimeline,
  useEventTimelineLoader,
  useLiveEventArrive,
  useLiveEventDecryption,
  useLiveTimelineRefresh,
  useTimelinePagination,
} from './timelineState';
import type { Timeline } from './timelineState';
import { scrollToBottom } from '../../../utils/dom';
import { DefaultPlaceholder, CompactPlaceholder, MessageBase } from '../../../components/message';
import {
  factoryRenderLinkifyWithMention,
  getReactCustomHtmlParser,
  LINKIFY_OPTS,
  makeMentionCustomProps,
  renderMatrixMention,
} from '../../../plugins/react-custom-html-parser';
import {
  decryptAllTimelineEvent,
  getEditedEvent,
  getEventReactions,
  isInvisibleTimelineEvent,
} from '../../../utils/room';
import { willEventRender } from './willEventRender';
import { getRoomUnreadInfo, useTimelineReadMarker } from './useTimelineReadMarker';
import { useTimelineClickHandlers } from './useTimelineClickHandlers';
import {
  getEventIdAbsoluteIndex,
  getEventTimeline,
  getLinkedTimelines,
  getLiveTimeline,
  getTimelineAndBaseIndex,
  getTimelineEvent,
  getTimelineRelativeIndex,
  getTimelinesEventsCount,
} from './timelineUtils';
import { useSetting } from '../../../state/hooks/settings';
import { MessageLayout, settingsAtom } from '../../../state/settings';
import { RoomIntro } from '../../../components/room-intro';
import { TimelineMessageContext } from './TimelineMessageContext';
import { MemoizedTimelineEvent } from './MemoizedTimelineEvent';
import { SelectionActionBar } from './SelectionActionBar';
import { useBulkSelection } from './useBulkSelection';
import { markAsRead } from '../../../utils/notifications';

import { getResizeObserverEntry, useResizeObserver } from '../../../hooks/useResizeObserver';
import { timeDayMonthYear, today, yesterday } from '../../../utils/time';
import {
  buildTimelineDescriptors,
  computeImageGroups,
  groupsEqual,
} from '../../../utils/buildTimelineDescriptors';
import type {
  ImageGroupsSnapshot,
  TimelineEventInput,
} from '../../../utils/buildTimelineDescriptors';
import type { EditorController } from '../../../components/editor';
import { roomIdToReplyDraftAtomFamily } from '../../../state/room/roomInputDrafts';
import { usePowerLevelsContext } from '../../../hooks/usePowerLevels';
import { MessageEvent, StateEvent } from '../../../../types/matrix/room';
import { useDocumentFocusChange } from '../../../hooks/useDocumentFocusChange';
import { roomToParentsAtom } from '../../../state/room/roomToParents';
import { useRoomUnread } from '../../../state/hooks/unread';
import { roomToUnreadAtom } from '../../../state/room/roomToUnread';
import { useMentionClickHandler } from '../../../hooks/useMentionClickHandler';
import { useSpoilerClickHandler } from '../../../hooks/useSpoilerClickHandler';
import { useRoomNavigate } from '../../../hooks/useRoomNavigate';
import { useMediaAuthentication } from '../../../hooks/useMediaAuthentication';
import { useIgnoredUsers } from '../../../hooks/useIgnoredUsers';
import { timelineSliderPositionAtom, timelineSliderVisibleAtom } from './TimelineSlider';
import { useImagePackRooms } from '../../../hooks/useImagePackRooms';
import { useIsDirectRoom } from '../../../hooks/useRoom';
import { useOpenUserRoomProfile } from '../../../state/hooks/userRoomProfile';
import { useSpaceOptionally } from '../../../hooks/useSpace';
import { useRoomCreators } from '../../../hooks/useRoomCreators';
import { useRoomPermissions } from '../../../hooks/useRoomPermissions';
import {
  useAccessiblePowerTagColors,
  useGetMemberPowerTag,
} from '../../../hooks/useMemberPowerTag';
import { useTheme } from '../../../hooks/useTheme';
import { useRoomCreatorsTag } from '../../../hooks/useRoomCreatorsTag';
import { usePowerLevelTags } from '../../../hooks/usePowerLevelTags';
import { useTimelineAutoScroll } from './useTimelineAutoScroll';
import { JumpToLatestButton } from './JumpToLatestButton';
import { TimelineOverlay } from './TimelineOverlay';

const TimelineDivider = as<'div', { variant?: ContainerColor | 'Inherit' }>(
  ({ variant, children, ...props }, ref) => (
    <Box gap="100" justifyContent="Center" alignItems="Center" {...props} ref={ref}>
      <Line style={{ flexGrow: 1 }} variant={variant} size="300" />
      {children}
      <Line style={{ flexGrow: 1 }} variant={variant} size="300" />
    </Box>
  )
);

type RoomTimelineProps = {
  room: Room;
  eventId?: string;
  roomInputRef: RefObject<HTMLElement>;
  editorInputRef: RefObject<EditorController | null>;
};

export function RoomTimeline({ room, eventId, roomInputRef, editorInputRef }: RoomTimelineProps) {
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
  const [pauseGifs] = useSetting(settingsAtom, 'pauseGifs');

  const ignoredUsersList = useIgnoredUsers();
  const ignoredUsersSet = useMemo(() => new Set(ignoredUsersList), [ignoredUsersList]);

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

  const {
    unreadInfo,
    setUnreadInfo,
    readUptoEventIdRef,
    willScrollToReadMarker,
    tryAutoMarkAsRead,
  } = useTimelineReadMarker(mx, room, hideActivity, !!unread);
  const contentRef = useRef<HTMLDivElement>(null);

  const [docFocused, setDocFocused] = useState(() =>
    typeof document !== 'undefined' ? document.hasFocus() : true
  );
  useDocumentFocusChange(useCallback((focused: boolean) => setDocFocused(focused), []));

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
      if (evt && !isInvisibleTimelineEvent(evt)) return false;
    }
    return true;
  })();
  const viewingLatestRef = useRef(liveTimelineLinked && rangeAtNewest);
  viewingLatestRef.current = liveTimelineLinked && rangeAtNewest;

  const {
    scrollRef,
    atBottomAnchorRef,
    atBottom,
    atBottomRef,
    autoScrolling,
    setAtBottom,
    requestScrollToBottom,
  } = useTimelineAutoScroll({
    room,
    viewingLatest: viewingLatestRef.current,
    autoPinEnabled: docFocused || unfocusedAutoScroll,
    initiallyAtBottom: !willScrollToReadMarker,
  });

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

  const getScrollElement = useCallback(() => scrollRef.current, [scrollRef]);

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
        [scrollRef]
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
      [alive, readUptoEventIdRef]
    ),
    useCallback(() => {
      if (!alive()) return;
      setTimeline(getInitialTimeline(room));
      requestScrollToBottom(false);
      setSliderPosition(1);
    }, [alive, room, setSliderPosition, requestScrollToBottom])
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
        const isInvisible = isInvisibleTimelineEvent(mEvt);

        if (atBottomRef.current) {
          if (!isInvisible) {
            if (document.hasFocus() && (!unreadInfo || mEvt.getSender() === mx.getUserId())) {
              const evtRoomId = mEvt.getRoomId();
              if (evtRoomId) {
                markAsRead(mx, evtRoomId, hideActivity);
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
      [mx, room, unreadInfo, hideActivity, unfocusedAutoScroll, atBottomRef, setUnreadInfo]
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
    [room, scrollToItem, loadEventTimeline, setAtBottom]
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
      if (!viewingLatestRef.current) return;

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
        requestScrollToBottom(false);
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [room, requestScrollToBottom]);

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
    }, [getScrollElement, atBottomRef]),
    useCallback(() => contentRef.current, [])
  );

  // Stay at bottom when the room editor resizes
  useResizeObserver(
    useMemo(() => {
      let mounted = false;
      return (entries) => {
        if (!mounted) {
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
    }, [getScrollElement, roomInputRef, atBottomRef]),
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
    }, [getScrollElement, atBottomRef]),
    useCallback(() => scrollRef.current, [scrollRef])
  );

  useEffect(() => {
    if (atBottom && document.hasFocus()) {
      tryAutoMarkAsRead();
    }
  }, [atBottom, tryAutoMarkAsRead]);

  useDocumentFocusChange(
    useCallback(
      (inFocus) => {
        if (inFocus && atBottomRef.current) {
          if (!unfocusedAutoScroll && unreadInfo?.inLiveTimeline) {
            handleOpenEvent(unreadInfo.readUptoEventId, false, (scrolled) => {
              if (!scrolled) {
                tryAutoMarkAsRead();
              }
            });
            return;
          }
          tryAutoMarkAsRead();
        }
      },
      [tryAutoMarkAsRead, unreadInfo, handleOpenEvent, unfocusedAutoScroll, atBottomRef]
    )
  );

  useEffect(() => {
    if (!eventId) return;
    setAtBottom(false);
    setTimeline(getEmptyTimeline());
    loadEventTimeline(eventId);
  }, [eventId, loadEventTimeline, setAtBottom]);

  const prevEventIdRef = useRef(eventId);
  useEffect(() => {
    const prev = prevEventIdRef.current;
    prevEventIdRef.current = eventId;
    if (prev && !eventId) {
      setTimeline(getInitialTimeline(room));
      requestScrollToBottom(false);
    }
  }, [eventId, room, requestScrollToBottom]);

  useLayoutEffect(() => {
    const scrollEl = scrollRef.current;
    if (scrollEl) {
      scrollToBottom(scrollEl);
    }
  }, [scrollRef]);

  // On initial open of an unread room, place the last-read event at the
  // bottom of the viewport so the new-messages divider sits at the end of
  // the view.
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
          align: 'end',
          stopInView: true,
        });
      }
    }
  }, [room, unreadInfo, scrollToItem]);

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
  }, [focusItem, scrollRef]);

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

  // When edit mode opens on a message, scroll it into view so the inline editor is visible.
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
  }, [scrollToElement, editId, scrollRef]);

  const handleJumpToLatest = () => {
    if (eventId) {
      navigateRoom(room.roomId, undefined, { replace: true });
    }
    setTimeline(getInitialTimeline(room));
    requestScrollToBottom(false);
    setSliderPosition(1);
  };

  const handleJumpToUnread = () => {
    if (unreadInfo?.readUptoEventId) {
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

  const { handleUserClick, handleUsernameClick, handleReplyClick, handleReactionToggle } =
    useTimelineClickHandlers({
      mx,
      room,
      spaceRoomId: space?.roomId,
      openUserRoomProfile,
      editorInputRef,
      replyDraftAtom: roomIdToReplyDraftAtomFamily(room.roomId),
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

  const handleDecryptRetry = useCallback(async () => {
    await Promise.allSettled(
      linkedTimelinesRef.current.map((tl) => decryptAllTimelineEvent(mx, tl))
    );
  }, [mx]);

  const { selectionMode, selectedIds, bulkDeleting, handleBulkDelete, handleCancelSelection } =
    useBulkSelection(mx, room);

  const eventsRef = useRef<TimelineEventInput[]>([]);
  const cachedGroupsRef = useRef<ImageGroupsSnapshot | null>(null);
  const willRenderRef = useRef<(mEvent: MatrixEvent) => boolean>(() => true);

  const buildTimelineItems = () => {
    const events: TimelineEventInput[] = [];

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

    const willRender = (mEvent: MatrixEvent) =>
      willEventRender(mEvent, {
        showHiddenEvents,
        hideMembershipEvents,
        hideNickAvatarEvents,
      });

    const groups = computeImageGroups(events, willRender);
    eventsRef.current = events;
    willRenderRef.current = willRender;
    cachedGroupsRef.current = groups;

    return buildTimelineDescriptors(
      events,
      readUptoEventIdRef.current ?? undefined,
      mx.getSafeUserId(),
      willRender,
      groups
    );
  };

  const timelineItems = buildTimelineItems();

  // Unused value; setter call forces a rerender after grouping changes.
  const [, setLastDecryptedId] = useState<string | null>(null);

  const handleEventDecrypted = useCallback((mEvent: MatrixEvent) => {
    const events = eventsRef.current;
    const willRender = willRenderRef.current;
    if (events.length === 0) return;
    const newGroups = computeImageGroups(events, willRender);
    const cached = cachedGroupsRef.current;
    if (cached && groupsEqual(cached, newGroups)) return;
    cachedGroupsRef.current = newGroups;
    const id = mEvent.getId();
    if (id) setLastDecryptedId(id);
  }, []);

  useLiveEventDecryption(room, handleEventDecrypted);

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
        <JumpToLatestButton
          scrollRef={scrollRef}
          lastMessageIndex={
            liveTimelineLinked &&
            rangeAtNewest &&
            timeline.range.newest - 1 >= timeline.range.oldest
              ? timeline.range.newest - 1
              : null
          }
          atBottom={atBottom}
          autoScrolling={autoScrolling}
          onClick={handleJumpToLatest}
        />
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
