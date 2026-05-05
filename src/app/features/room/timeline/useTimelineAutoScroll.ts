import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { MutableRefObject, RefObject } from 'react';
import type { EventTimelineSetHandlerMap, Room, RoomEventHandlerMap } from 'matrix-js-sdk';
import { RoomEvent } from 'matrix-js-sdk';
import {
  getIntersectionObserverEntry,
  useIntersectionObserver,
} from '../../../hooks/useIntersectionObserver';
import { useResizeObserver } from '../../../hooks/useResizeObserver';
import { useEvent } from '../../../hooks/useEvent';
import { computeAnchorScrollTop, scrollToBottom, type ScrollAlign } from '../../../utils/dom';

export type ScrollAnchor =
  | { kind: 'free' }
  | { kind: 'bottom' }
  | { kind: 'event'; eventId: string; align: ScrollAlign; offset?: number }
  | { kind: 'marker'; markerId: string; align: ScrollAlign; offset?: number };

export type SetAnchorOptions = {
  behavior?: ScrollBehavior;
  skipIfVisible?: boolean;
};

// Event anchors reuse the existing data-message-id attribute on message
// wrappers. Marker anchors are sparse (read marker, etc.) and use a dedicated
// data-anchor-id attribute that callers add to the marker element.
export const getMarkerAnchorId = (markerId: string): string => `marker:${markerId}`;

export const NEW_MESSAGES_DIVIDER_TOP_OFFSET_FRACTION = 0.12;

const findAnchorElement = (
  scrollElement: HTMLElement,
  anchor: Extract<ScrollAnchor, { kind: 'event' | 'marker' }>
): HTMLElement | null => {
  if (anchor.kind === 'event') {
    return scrollElement.querySelector<HTMLElement>(
      `[data-message-id="${CSS.escape(anchor.eventId)}"]`
    );
  }
  return scrollElement.querySelector<HTMLElement>(
    `[data-anchor-id="${CSS.escape(getMarkerAnchorId(anchor.markerId))}"]`
  );
};

const isFullyVisible = (scrollElement: HTMLElement, element: HTMLElement): boolean => {
  const elementRect = element.getBoundingClientRect();
  const scrollRect = scrollElement.getBoundingClientRect();
  return elementRect.top >= scrollRect.top && elementRect.bottom <= scrollRect.bottom;
};

export type TimelineAutoScrollOptions = {
  room: Room;
  viewingLatest: boolean;
  autoPinEnabled?: boolean;
  initiallyAtBottom?: boolean;
  // Optional content element getter. When provided, the controller observes
  // it for size changes and re-applies tracked event/marker anchors. The
  // bottom-pin path is intentionally not driven by this — it stays
  // matrix-event-driven via the Timeline/Redaction listeners.
  getContentElement?: () => Element | null;
};

export type TimelineAutoScroll = {
  scrollRef: RefObject<HTMLDivElement>;
  atBottomAnchorRef: RefObject<HTMLElement>;
  atBottom: boolean;
  atBottomRef: MutableRefObject<boolean>;
  autoScrolling: boolean;
  setAtBottom: (value: boolean) => void;
  requestScrollToBottom: (smooth?: boolean) => void;
  setAnchor: (anchor: ScrollAnchor, options?: SetAnchorOptions) => boolean;
};

export function useTimelineAutoScroll({
  room,
  viewingLatest,
  autoPinEnabled = true,
  initiallyAtBottom = true,
  getContentElement,
}: TimelineAutoScrollOptions): TimelineAutoScroll {
  const scrollRef = useRef<HTMLDivElement>(null);
  const atBottomAnchorRef = useRef<HTMLElement>(null);

  const [atBottom, setAtBottomState] = useState<boolean>(initiallyAtBottom);
  const atBottomRef = useRef(initiallyAtBottom);

  const viewingLatestRef = useRef(viewingLatest);
  viewingLatestRef.current = viewingLatest;

  const autoPinEnabledRef = useRef(autoPinEnabled);
  autoPinEnabledRef.current = autoPinEnabled;

  const [scrollRequest, setScrollRequest] = useState<{ smooth: boolean } | null>(null);

  const [autoScrolling, setAutoScrolling] = useState(false);

  const setAtBottom = useCallback((value: boolean) => {
    atBottomRef.current = value;
    setAtBottomState(value);
  }, []);

  const requestScrollToBottom = useCallback((smooth = true) => {
    setScrollRequest({ smooth });
  }, []);

  useIntersectionObserver(
    useCallback((entries) => {
      const target = atBottomAnchorRef.current;
      if (!target) return;
      const entry = getIntersectionObserverEntry(target, entries);
      if (!entry) return;
      if (entry.isIntersecting && viewingLatestRef.current) {
        atBottomRef.current = true;
        setAtBottomState(true);
      } else if (!entry.isIntersecting) {
        atBottomRef.current = false;
        setAtBottomState(false);
      }
    }, []),
    useCallback(() => ({ root: scrollRef.current, rootMargin: '100px' }), []),
    useCallback(() => atBottomAnchorRef.current, [])
  );

  useEffect(() => {
    const handleTimelineEvent: EventTimelineSetHandlerMap[RoomEvent.Timeline] = (
      _mEvent,
      eventRoom,
      _toStartOfTimeline,
      _removed,
      data
    ) => {
      if (eventRoom?.roomId !== room.roomId || !data.liveEvent) return;
      if (!autoPinEnabledRef.current) return;
      if (!atBottomRef.current) return;
      if (!viewingLatestRef.current) return;
      requestScrollToBottom(true);
    };
    const handleRedaction: RoomEventHandlerMap[RoomEvent.Redaction] = (_mEvent, eventRoom) => {
      if (eventRoom?.roomId !== room.roomId) return;
      if (!autoPinEnabledRef.current) return;
      if (!atBottomRef.current) return;
      if (!viewingLatestRef.current) return;
      requestScrollToBottom(true);
    };
    room.on(RoomEvent.Timeline, handleTimelineEvent);
    room.on(RoomEvent.Redaction, handleRedaction);
    return () => {
      room.removeListener(RoomEvent.Timeline, handleTimelineEvent);
      room.removeListener(RoomEvent.Redaction, handleRedaction);
    };
  }, [room, requestScrollToBottom]);

  useLayoutEffect(() => {
    if (!scrollRequest) return;
    const scrollEl = scrollRef.current;
    if (!scrollEl) return;
    const target = scrollEl.scrollHeight - scrollEl.offsetHeight;
    const needsScroll = Math.abs(scrollEl.scrollTop - target) > 1;
    scrollToBottom(scrollEl, scrollRequest.smooth ? 'smooth' : 'instant');
    // While a smooth scroll is animating, IntersectionObserver-derived state
    // (atBottom, lastMsgVisible in the consumer) can transiently flip, causing
    // UI like the "Jump to Latest" button to flash. Mark autoScrolling true
    // for the duration so consumers can gate on it; scrollend clears it.
    if (scrollRequest.smooth && needsScroll) {
      setAutoScrolling(true);
    }
  }, [scrollRequest]);

  // Tracked anchor for ResizeObserver-driven re-snap. Only event/marker kinds
  // get tracked; bottom and free are no-ops here so the bottom-pin path stays
  // event-driven.
  const trackedAnchorRef = useRef<ScrollAnchor>({ kind: 'free' });

  // Returns true if a scroll happened or is scheduled (element not yet in DOM
  // — the tracked anchor will re-apply when the resize observer fires after
  // the next layout). Returns false if no scroll happened (element already
  // visible and skipIfVisible was true, or anchor.kind was free, or no scroll
  // element).
  const applyAnchor = useEvent(
    (anchor: ScrollAnchor, behavior: ScrollBehavior, skipIfVisible: boolean): boolean => {
      const scrollEl = scrollRef.current;
      if (!scrollEl) return false;
      if (anchor.kind === 'free') return false;
      if (anchor.kind === 'bottom') {
        scrollToBottom(scrollEl, behavior);
        return true;
      }
      const el = findAnchorElement(scrollEl, anchor);
      if (!el) return true;
      if (skipIfVisible && isFullyVisible(scrollEl, el)) return false;
      scrollEl.scrollTo({
        top: computeAnchorScrollTop(scrollEl, el, anchor.align, anchor.offset ?? 0),
        behavior,
      });
      return true;
    }
  );

  const setAnchor = useCallback(
    (anchor: ScrollAnchor, options?: SetAnchorOptions): boolean => {
      trackedAnchorRef.current =
        anchor.kind === 'event' || anchor.kind === 'marker' ? anchor : { kind: 'free' };
      return applyAnchor(anchor, options?.behavior ?? 'instant', options?.skipIfVisible ?? false);
    },
    [applyAnchor]
  );

  const handleResize = useEvent(() => {
    const anchor = trackedAnchorRef.current;
    if (anchor.kind !== 'event' && anchor.kind !== 'marker') return;
    applyAnchor(anchor, 'instant', false);
  });

  useResizeObserver(handleResize, getContentElement);

  // User input releases tracked anchor so subsequent layout shifts don't
  // snap back over a manual scroll.
  useEffect(() => {
    const scrollEl = scrollRef.current;
    if (!scrollEl) return undefined;
    const release = () => {
      const anchor = trackedAnchorRef.current;
      if (anchor.kind === 'event' || anchor.kind === 'marker') {
        trackedAnchorRef.current = { kind: 'free' };
      }
    };
    scrollEl.addEventListener('wheel', release, { passive: true });
    scrollEl.addEventListener('touchmove', release, { passive: true });
    scrollEl.addEventListener('mousedown', release);
    scrollEl.addEventListener('keydown', release);
    return () => {
      scrollEl.removeEventListener('wheel', release);
      scrollEl.removeEventListener('touchmove', release);
      scrollEl.removeEventListener('mousedown', release);
      scrollEl.removeEventListener('keydown', release);
    };
  }, []);

  useEffect(() => {
    const scrollEl = scrollRef.current;
    if (!scrollEl) return undefined;
    const handleScrollEnd = () => setAutoScrolling(false);
    scrollEl.addEventListener('scrollend', handleScrollEnd);
    return () => {
      scrollEl.removeEventListener('scrollend', handleScrollEnd);
    };
  }, []);

  return {
    scrollRef,
    atBottomAnchorRef,
    atBottom,
    atBottomRef,
    autoScrolling,
    setAtBottom,
    requestScrollToBottom,
    setAnchor,
  };
}
