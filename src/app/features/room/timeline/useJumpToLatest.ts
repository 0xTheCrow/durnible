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
  autoPinEnabled?: boolean;
  initiallyAtBottom?: boolean;
};

export type UseJumpToLatest = {
  scrollRef: RefObject<HTMLDivElement>;
  contentRef: RefObject<HTMLDivElement>;
  lastMessageRef: (node: HTMLElement | null) => void;
  isAtBottom: boolean;
  isAtBottomRef: MutableRefObject<boolean>;
  // False until the IntersectionObserver has produced its first reading.
  // Use to delay button visibility decisions on initial mount so the button
  // doesn't flash before the observer has caught up.
  hasObserved: boolean;
  setIsAtBottom: (value: boolean) => void;
  requestScrollToBottom: (smooth?: boolean) => void;
};

export function useJumpToLatest({
  room,
  viewingLatest,
  autoPinEnabled = true,
  initiallyAtBottom = true,
}: UseJumpToLatestOptions): UseJumpToLatest {
  const scrollRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);

  const [isAtBottom, setIsAtBottomState] = useState(initiallyAtBottom);
  const isAtBottomRef = useRef(initiallyAtBottom);
  const [hasObserved, setHasObserved] = useState(false);

  const [lastMessageNode, setLastMessageNode] = useState<HTMLElement | null>(null);
  const lastMessageRef = useCallback((node: HTMLElement | null) => {
    setLastMessageNode(node);
  }, []);

  const viewingLatestRef = useRef(viewingLatest);
  viewingLatestRef.current = viewingLatest;

  const autoPinEnabledRef = useRef(autoPinEnabled);
  autoPinEnabledRef.current = autoPinEnabled;

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
    if (!lastMessageNode) return undefined;

    const observer = new IntersectionObserver(
      (entries) => {
        if (suppressIORef.current) return;
        const entry = entries.find((e) => e.target === lastMessageNode);
        if (!entry) return;
        const next = entry.isIntersecting;
        setHasObserved(true);
        if (isAtBottomRef.current === next) return;
        isAtBottomRef.current = next;
        setIsAtBottomState(next);
      },
      { root: scrollEl }
    );
    observer.observe(lastMessageNode);
    return () => observer.disconnect();
  }, [lastMessageNode, viewingLatest]);

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
    lastMessageRef,
    isAtBottom,
    isAtBottomRef,
    hasObserved,
    setIsAtBottom,
    requestScrollToBottom,
  };
}
