import type { MutableRefObject } from 'react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useEvent } from '../../../hooks/useEvent';

export type Align = 'start' | 'center' | 'end';

export type Anchor =
  | { kind: 'free' }
  | { kind: 'bottom' }
  | { kind: 'event'; eventId: string; align: Align; offset?: number }
  | { kind: 'marker'; markerId: string; align: Align; offset?: number };

export type SetAnchorOptions = {
  behavior?: ScrollBehavior;
  skipIfVisible?: boolean;
};

export type ScrollController = {
  scrollRef: (element: HTMLElement | null) => void;
  contentRef: (element: HTMLElement | null) => void;
  lastMessageRef: (element: HTMLElement | null) => void;
  getScrollElement: () => HTMLElement | null;
  isAtBottom: boolean;
  isAtBottomRef: MutableRefObject<boolean>;
  hasObserved: boolean;
  setAnchor: (anchor: Anchor, options?: SetAnchorOptions) => void;
};

export type ScrollControllerOptions = {
  autoPinEnabled?: boolean;
};

export const computeAnchorScrollTop = (
  scrollElement: HTMLElement,
  element: HTMLElement,
  align: Align,
  offset: number
): number => {
  const elementRect = element.getBoundingClientRect();
  const scrollRect = scrollElement.getBoundingClientRect();
  const topRelativeToScrollContainer = elementRect.top - scrollRect.top + scrollElement.scrollTop;
  const viewportHeight = scrollElement.clientHeight;
  const maxScrollTop = Math.max(0, scrollElement.scrollHeight - viewportHeight);
  let targetScrollTop: number;
  switch (align) {
    case 'start':
      targetScrollTop = topRelativeToScrollContainer - offset;
      break;
    case 'end':
      targetScrollTop =
        topRelativeToScrollContainer + element.offsetHeight - viewportHeight + offset;
      break;
    case 'center':
    default:
      targetScrollTop = topRelativeToScrollContainer - (viewportHeight - element.offsetHeight) / 2;
      break;
  }
  return Math.max(0, Math.min(targetScrollTop, maxScrollTop));
};

const isFullyVisible = (scrollElement: HTMLElement, element: HTMLElement): boolean => {
  const elementRect = element.getBoundingClientRect();
  const scrollRect = scrollElement.getBoundingClientRect();
  return elementRect.top >= scrollRect.top && elementRect.bottom <= scrollRect.bottom;
};

const findAnchorElement = (
  scrollElement: HTMLElement,
  anchor: Extract<Anchor, { kind: 'event' | 'marker' }>
): HTMLElement | null => {
  const dataAnchorId =
    anchor.kind === 'event' ? `event:${anchor.eventId}` : `marker:${anchor.markerId}`;
  return scrollElement.querySelector<HTMLElement>(`[data-anchor-id="${CSS.escape(dataAnchorId)}"]`);
};

export const useScrollController = (
  loadEventTimeline: (eventId: string) => Promise<void>,
  options: ScrollControllerOptions = {}
): ScrollController => {
  const { autoPinEnabled = true } = options;
  const [scrollElement, setScrollElement] = useState<HTMLElement | null>(null);
  const [contentElement, setContentElement] = useState<HTMLElement | null>(null);
  const [lastMessageElement, setLastMessageElement] = useState<HTMLElement | null>(null);
  const [isAtBottom, setIsAtBottom] = useState(false);
  const [hasObserved, setHasObserved] = useState(false);

  const anchorRef = useRef<Anchor>({ kind: 'free' });
  const intersectionObserverRef = useRef<IntersectionObserver | null>(null);
  const isAtBottomRef = useRef(false);

  const apply = useEvent(
    (anchor: Anchor, behavior: ScrollBehavior, skipIfVisible: boolean): void => {
      if (!scrollElement || anchor.kind === 'free') return;
      if (anchor.kind === 'bottom') {
        scrollElement.scrollTo({ top: scrollElement.scrollHeight, behavior });
        return;
      }
      const element = findAnchorElement(scrollElement, anchor);
      if (!element) {
        if (anchor.kind === 'event') {
          loadEventTimeline(anchor.eventId);
        }
        return;
      }
      if (skipIfVisible && isFullyVisible(scrollElement, element)) return;
      scrollElement.scrollTo({
        top: computeAnchorScrollTop(scrollElement, element, anchor.align, anchor.offset ?? 0),
        behavior,
      });
    }
  );

  const setAnchor = useCallback(
    (anchor: Anchor, setAnchorOptions?: SetAnchorOptions) => {
      anchorRef.current = anchor;
      apply(
        anchor,
        setAnchorOptions?.behavior ?? 'instant',
        setAnchorOptions?.skipIfVisible ?? false
      );
    },
    [apply]
  );

  const getScrollElement = useCallback(() => scrollElement, [scrollElement]);

  const handleResize = useEvent(() => {
    if (!scrollElement) return;
    const currentAnchor = anchorRef.current;
    if (currentAnchor.kind === 'free') return;
    if (currentAnchor.kind === 'bottom' && !autoPinEnabled) return;
    apply(currentAnchor, 'instant', false);
  });

  useEffect(() => {
    if (!scrollElement) return undefined;
    const resizeObserver = new ResizeObserver(handleResize);
    resizeObserver.observe(scrollElement);
    if (contentElement) resizeObserver.observe(contentElement);
    return () => resizeObserver.disconnect();
  }, [scrollElement, contentElement, handleResize]);

  useEffect(() => {
    if (!scrollElement) return undefined;
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries[0]?.isIntersecting ?? false;
        isAtBottomRef.current = visible;
        setIsAtBottom(visible);
        setHasObserved(true);
        const currentAnchor = anchorRef.current;
        if (visible && currentAnchor.kind === 'free') {
          anchorRef.current = { kind: 'bottom' };
        } else if (!visible && currentAnchor.kind === 'bottom') {
          anchorRef.current = { kind: 'free' };
        }
      },
      { root: scrollElement }
    );
    intersectionObserverRef.current = observer;
    return () => {
      observer.disconnect();
      intersectionObserverRef.current = null;
    };
  }, [scrollElement]);

  useEffect(() => {
    const observer = intersectionObserverRef.current;
    if (!observer || !lastMessageElement) return undefined;
    observer.observe(lastMessageElement);
    return () => observer.unobserve(lastMessageElement);
  }, [lastMessageElement]);

  useEffect(() => {
    if (!scrollElement) return undefined;
    const release = () => {
      const currentAnchor = anchorRef.current;
      if (currentAnchor.kind === 'event' || currentAnchor.kind === 'marker') {
        anchorRef.current = { kind: 'free' };
      }
    };
    scrollElement.addEventListener('wheel', release, { passive: true });
    scrollElement.addEventListener('touchmove', release, { passive: true });
    scrollElement.addEventListener('mousedown', release);
    scrollElement.addEventListener('keydown', release);
    return () => {
      scrollElement.removeEventListener('wheel', release);
      scrollElement.removeEventListener('touchmove', release);
      scrollElement.removeEventListener('mousedown', release);
      scrollElement.removeEventListener('keydown', release);
    };
  }, [scrollElement]);

  return {
    scrollRef: setScrollElement,
    contentRef: setContentElement,
    lastMessageRef: setLastMessageElement,
    getScrollElement,
    isAtBottom,
    isAtBottomRef,
    hasObserved,
    setAnchor,
  };
};
