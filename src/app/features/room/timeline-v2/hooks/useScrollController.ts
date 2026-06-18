import type { RefObject } from 'react';
import { useCallback, useEffect, useMemo, useRef } from 'react';
import { computeAnchorScrollTop, scrollToBottom, type ScrollAlign } from '../../../../utils/dom';

type AnchorIntent = {
  kind: 'anchor';
  selector: string;
  align: ScrollAlign;
  offset: number;
  offsetFraction?: number;
};

export type ScrollIntent = { kind: 'free' } | { kind: 'followLive' } | AnchorIntent;

type AnchorOptions = {
  align?: ScrollAlign;
  offset?: number;
  offsetFraction?: number;
};

type BehaviorOptions = {
  animate?: boolean;
};

type UseScrollControllerParams = {
  scrollRef: RefObject<HTMLDivElement>;
  contentRef: RefObject<HTMLDivElement>;
  isInLivePaginationWindowRef: RefObject<boolean>;
  unfocusedAutoScrollRef: RefObject<boolean>;
};

export type ScrollController = {
  pinToLiveEnd: (options?: BehaviorOptions) => void;
  pinToAnchor: (selector: string, options?: AnchorOptions, behavior?: BehaviorOptions) => void;
  release: () => void;
  releaseFollowLive: () => void;
  syncFollowLive: (atBottom: boolean) => void;
  intentRef: RefObject<ScrollIntent>;
};

const AUTO_SCROLL_FALLBACK_MS = 1000;

const ANCHOR_SATISFIED_TOLERANCE_PX = 2;

const anchorOffsetPx = (intent: AnchorIntent, scrollElement: HTMLElement): number =>
  intent.offsetFraction !== undefined
    ? Math.round(scrollElement.clientHeight * intent.offsetFraction)
    : intent.offset;

export const useScrollController = ({
  scrollRef,
  contentRef,
  isInLivePaginationWindowRef,
  unfocusedAutoScrollRef,
}: UseScrollControllerParams): ScrollController => {
  const intentRef = useRef<ScrollIntent>({ kind: 'free' });
  const autoScrollingRef = useRef(false);
  const autoScrollTimerRef = useRef(0);

  const beginAutoScroll = useCallback(() => {
    autoScrollingRef.current = true;
    window.clearTimeout(autoScrollTimerRef.current);
    autoScrollTimerRef.current = window.setTimeout(() => {
      autoScrollingRef.current = false;
    }, AUTO_SCROLL_FALLBACK_MS);
  }, []);

  const apply = useCallback(
    (behavior: 'instant' | 'smooth') => {
      const scrollElement = scrollRef.current;
      if (!scrollElement) return;
      const intent = intentRef.current;
      if (intent.kind === 'free') return;
      if (intent.kind === 'followLive') {
        scrollToBottom(scrollElement, behavior);
        return;
      }
      const targetElement = scrollElement.querySelector<HTMLElement>(intent.selector);
      if (!targetElement || !targetElement.isConnected) return;
      const targetRect = targetElement.getBoundingClientRect();
      const scrollRect = scrollElement.getBoundingClientRect();
      const offset = anchorOffsetPx(intent, scrollElement);
      const topInView = targetRect.top >= scrollRect.top && targetRect.top <= scrollRect.bottom;
      const satisfied =
        intent.align === 'start'
          ? Math.abs(targetRect.top - (scrollRect.top + offset)) <= ANCHOR_SATISFIED_TOLERANCE_PX
          : topInView && targetRect.bottom <= scrollRect.bottom;
      if (satisfied) return;
      scrollElement.scrollTo({
        top: computeAnchorScrollTop(scrollElement, targetElement, intent.align, offset),
        behavior,
      });
    },
    [scrollRef]
  );

  const pinToLiveEnd = useCallback(
    ({ animate = false }: BehaviorOptions = {}) => {
      intentRef.current = { kind: 'followLive' };
      if (animate) beginAutoScroll();
      apply(animate ? 'smooth' : 'instant');
    },
    [apply, beginAutoScroll]
  );

  const pinToAnchor = useCallback(
    (selector: string, options: AnchorOptions = {}, { animate = false }: BehaviorOptions = {}) => {
      intentRef.current = {
        kind: 'anchor',
        selector,
        align: options.align ?? 'center',
        offset: options.offset ?? 0,
        offsetFraction: options.offsetFraction,
      };
      if (animate) beginAutoScroll();
      apply(animate ? 'smooth' : 'instant');
    },
    [apply, beginAutoScroll]
  );

  const release = useCallback(() => {
    intentRef.current = { kind: 'free' };
  }, []);

  const releaseFollowLive = useCallback(() => {
    if (intentRef.current.kind === 'followLive') intentRef.current = { kind: 'free' };
  }, []);

  const syncFollowLive = useCallback(
    (atBottom: boolean) => {
      if (autoScrollingRef.current) return;
      if (atBottom && isInLivePaginationWindowRef.current) {
        intentRef.current = { kind: 'followLive' };
      } else if (intentRef.current.kind === 'followLive') {
        intentRef.current = { kind: 'free' };
      }
    },
    [isInLivePaginationWindowRef]
  );

  useEffect(() => {
    const scrollElement = scrollRef.current;
    const contentElement = contentRef.current;
    if (!scrollElement || !contentElement) return undefined;
    const maintainPosition = () => {
      if (intentRef.current.kind === 'free') return;
      if (
        intentRef.current.kind === 'followLive' &&
        !document.hasFocus() &&
        !unfocusedAutoScrollRef.current
      ) {
        return;
      }
      apply('instant');
    };
    const resizeObserver = new ResizeObserver(maintainPosition);
    resizeObserver.observe(contentElement);
    resizeObserver.observe(scrollElement);
    return () => resizeObserver.disconnect();
  }, [scrollRef, contentRef, apply, unfocusedAutoScrollRef]);

  useEffect(() => {
    const scrollElement = scrollRef.current;
    if (!scrollElement) return undefined;
    const endAutoScroll = () => {
      autoScrollingRef.current = false;
      window.clearTimeout(autoScrollTimerRef.current);
    };
    const handleUserInput = () => {
      if (intentRef.current.kind === 'anchor') intentRef.current = { kind: 'free' };
      endAutoScroll();
    };
    scrollElement.addEventListener('wheel', handleUserInput, { passive: true });
    scrollElement.addEventListener('touchmove', handleUserInput, { passive: true });
    scrollElement.addEventListener('mousedown', handleUserInput);
    scrollElement.addEventListener('keydown', handleUserInput);
    scrollElement.addEventListener('scrollend', endAutoScroll);
    return () => {
      scrollElement.removeEventListener('wheel', handleUserInput);
      scrollElement.removeEventListener('touchmove', handleUserInput);
      scrollElement.removeEventListener('mousedown', handleUserInput);
      scrollElement.removeEventListener('keydown', handleUserInput);
      scrollElement.removeEventListener('scrollend', endAutoScroll);
    };
  }, [scrollRef]);

  return useMemo(
    () => ({ pinToLiveEnd, pinToAnchor, release, releaseFollowLive, syncFollowLive, intentRef }),
    [pinToLiveEnd, pinToAnchor, release, releaseFollowLive, syncFollowLive]
  );
};
