import type { MutableRefObject, RefObject } from 'react';
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { EventTimelineSetHandlerMap, Room } from 'matrix-js-sdk';
import { RoomEvent } from 'matrix-js-sdk';
import { isInvisibleTimelineEvent } from '../../../utils/room';
import { scrollToBottom } from '../../../utils/dom';

const SCROLLEND_FALLBACK_MS = 500;

export type UseJumpToLatestOptions = {
  room: Room;
  viewingLatest: boolean;
  lastMessageIndex: number | null;
  // Event ID at lastMessageIndex. Used as an IO effect dep so the observer
  // re-targets when the underlying DOM node is replaced (e.g. local echo →
  // server-confirmed event causes a key change → unmount/mount).
  lastMessageEventId: string | null;
  autoPinEnabled?: boolean;
  initiallyAtBottom?: boolean;
};

export type UseJumpToLatest = {
  scrollRef: RefObject<HTMLDivElement>;
  contentRef: RefObject<HTMLDivElement>;
  isAtBottom: boolean;
  isAtBottomRef: MutableRefObject<boolean>;
  setIsAtBottom: (value: boolean) => void;
  requestScrollToBottom: (smooth?: boolean) => void;
};

export function useJumpToLatest({
  room,
  viewingLatest,
  lastMessageIndex,
  lastMessageEventId,
  autoPinEnabled = true,
  initiallyAtBottom = true,
}: UseJumpToLatestOptions): UseJumpToLatest {
  const scrollRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);

  const [isAtBottom, setIsAtBottomState] = useState(initiallyAtBottom);
  const isAtBottomRef = useRef(initiallyAtBottom);

  const viewingLatestRef = useRef(viewingLatest);
  viewingLatestRef.current = viewingLatest;

  const autoPinEnabledRef = useRef(autoPinEnabled);
  autoPinEnabledRef.current = autoPinEnabled;

  // True while a hook-initiated scroll is in flight. IntersectionObserver
  // callbacks during this window are ignored — they would otherwise transiently
  // report not-intersecting mid-animation and flash the button visible.
  const suppressIORef = useRef(false);
  const suppressTimeoutRef = useRef<number | null>(null);

  const [scrollRequest, setScrollRequest] = useState<{ smooth: boolean } | null>(null);

  const setIsAtBottom = useCallback((value: boolean) => {
    isAtBottomRef.current = value;
    setIsAtBottomState(value);
  }, []);

  const clearSuppressTimeout = useCallback(() => {
    if (suppressTimeoutRef.current !== null) {
      window.clearTimeout(suppressTimeoutRef.current);
      suppressTimeoutRef.current = null;
    }
  }, []);

  const beginSuppress = useCallback(() => {
    suppressIORef.current = true;
    clearSuppressTimeout();
    suppressTimeoutRef.current = window.setTimeout(() => {
      suppressIORef.current = false;
      suppressTimeoutRef.current = null;
    }, SCROLLEND_FALLBACK_MS);
  }, [clearSuppressTimeout]);

  const requestScrollToBottom = useCallback((smooth = true) => {
    setScrollRequest({ smooth });
  }, []);

  useEffect(() => {
    const scrollEl = scrollRef.current;
    if (!scrollEl) return undefined;
    if (!viewingLatest) return undefined;
    if (lastMessageIndex === null || lastMessageIndex < 0) return undefined;
    const target = scrollEl.querySelector(
      `[data-message-item="${lastMessageIndex}"]`
    ) as HTMLElement | null;
    if (!target) return undefined;

    const observer = new IntersectionObserver(
      (entries) => {
        if (suppressIORef.current) return;
        const entry = entries.find((e) => e.target === target);
        if (!entry) return;
        const next = entry.isIntersecting;
        if (isAtBottomRef.current === next) return;
        isAtBottomRef.current = next;
        setIsAtBottomState(next);
      },
      { root: scrollEl }
    );
    observer.observe(target);
    return () => observer.disconnect();
  }, [lastMessageIndex, lastMessageEventId, viewingLatest]);

  useEffect(() => {
    const scrollEl = scrollRef.current;
    if (!scrollEl) return undefined;

    let mounted = false;
    const observer = new ResizeObserver(() => {
      if (!mounted) {
        mounted = true;
        return;
      }
      if (!isAtBottomRef.current) return;
      beginSuppress();
      scrollToBottom(scrollEl);
    });
    observer.observe(scrollEl);
    const contentEl = contentRef.current;
    if (contentEl) observer.observe(contentEl);
    return () => observer.disconnect();
  }, [beginSuppress]);

  useEffect(() => {
    const handleTimelineEvent: EventTimelineSetHandlerMap[RoomEvent.Timeline] = (
      mEvent,
      eventRoom,
      _toStartOfTimeline,
      _removed,
      data
    ) => {
      if (eventRoom?.roomId !== room.roomId || !data.liveEvent) return;
      if (!autoPinEnabledRef.current) return;
      if (!isAtBottomRef.current) return;
      if (!viewingLatestRef.current) return;
      if (isInvisibleTimelineEvent(mEvent)) return;
      requestScrollToBottom(true);
    };
    room.on(RoomEvent.Timeline, handleTimelineEvent);
    return () => {
      room.removeListener(RoomEvent.Timeline, handleTimelineEvent);
    };
  }, [room, requestScrollToBottom]);

  useLayoutEffect(() => {
    if (!scrollRequest) return;
    const scrollEl = scrollRef.current;
    if (!scrollEl) return;
    beginSuppress();
    scrollToBottom(scrollEl, scrollRequest.smooth ? 'smooth' : 'instant');
  }, [scrollRequest, beginSuppress]);

  useEffect(() => {
    const scrollEl = scrollRef.current;
    if (!scrollEl) return undefined;
    const handleScrollEnd = () => {
      clearSuppressTimeout();
      suppressIORef.current = false;
    };
    scrollEl.addEventListener('scrollend', handleScrollEnd);
    return () => {
      scrollEl.removeEventListener('scrollend', handleScrollEnd);
    };
  }, [clearSuppressTimeout]);

  useEffect(
    () => () => {
      if (suppressTimeoutRef.current !== null) {
        window.clearTimeout(suppressTimeoutRef.current);
      }
    },
    []
  );

  return {
    scrollRef,
    contentRef,
    isAtBottom,
    isAtBottomRef,
    setIsAtBottom,
    requestScrollToBottom,
  };
}
