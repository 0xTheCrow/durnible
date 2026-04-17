import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { MutableRefObject, RefObject } from 'react';
import type { EventTimelineSetHandlerMap, Room, RoomEventHandlerMap } from 'matrix-js-sdk';
import { RoomEvent } from 'matrix-js-sdk';
import {
  getIntersectionObserverEntry,
  useIntersectionObserver,
} from '../../hooks/useIntersectionObserver';
import { scrollToBottom } from '../../utils/dom';

export type TimelineAutoScrollOptions = {
  room: Room;
  viewingLatest: boolean;
  autoPinEnabled?: boolean;
  initiallyAtBottom?: boolean;
};

export type TimelineAutoScroll = {
  scrollRef: RefObject<HTMLDivElement>;
  atBottomAnchorRef: RefObject<HTMLElement>;
  atBottom: boolean;
  atBottomRef: MutableRefObject<boolean>;
  setAtBottom: (value: boolean) => void;
  requestScrollToBottom: (smooth?: boolean) => void;
};

export function useTimelineAutoScroll({
  room,
  viewingLatest,
  autoPinEnabled = true,
  initiallyAtBottom = true,
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
    if (scrollRequest) {
      const scrollEl = scrollRef.current;
      if (scrollEl) {
        scrollToBottom(scrollEl, scrollRequest.smooth ? 'smooth' : 'instant');
      }
    }
  }, [scrollRequest]);

  return {
    scrollRef,
    atBottomAnchorRef,
    atBottom,
    atBottomRef,
    setAtBottom,
    requestScrollToBottom,
  };
}
