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

export type ScrollIntent = { kind: 'free' } | { kind: 'bottom' } | AnchorIntent;

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
};

export type ScrollController = {
  pinToBottom: (options?: BehaviorOptions) => void;
  pinToAnchor: (selector: string, options?: AnchorOptions, behavior?: BehaviorOptions) => void;
  release: () => void;
  reapply: () => void;
  notifyAtBottomChange: (atBottom: boolean) => void;
  intentRef: RefObject<ScrollIntent>;
};

const AUTO_SCROLL_FALLBACK_MS = 1000;

const anchorOffsetPx = (intent: AnchorIntent, scrollElement: HTMLElement): number =>
  intent.offsetFraction !== undefined
    ? Math.round(scrollElement.clientHeight * intent.offsetFraction)
    : intent.offset;

export const useScrollController = ({
  scrollRef,
  contentRef,
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
      if (intent.kind === 'bottom') {
        scrollToBottom(scrollElement, behavior);
        return;
      }
      const targetElement = scrollElement.querySelector<HTMLElement>(intent.selector);
      if (!targetElement || !targetElement.isConnected) return;
      const targetRect = targetElement.getBoundingClientRect();
      const scrollRect = scrollElement.getBoundingClientRect();
      const topInView = targetRect.top >= scrollRect.top && targetRect.top <= scrollRect.bottom;
      const satisfied =
        intent.align === 'start' ? topInView : topInView && targetRect.bottom <= scrollRect.bottom;
      if (satisfied) return;
      scrollElement.scrollTo({
        top: computeAnchorScrollTop(
          scrollElement,
          targetElement,
          intent.align,
          anchorOffsetPx(intent, scrollElement)
        ),
        behavior,
      });
    },
    [scrollRef]
  );

  const pinToBottom = useCallback(
    ({ animate = false }: BehaviorOptions = {}) => {
      intentRef.current = { kind: 'bottom' };
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

  const reapply = useCallback(() => {
    apply('instant');
  }, [apply]);

  const notifyAtBottomChange = useCallback((atBottom: boolean) => {
    if (autoScrollingRef.current) return;
    if (atBottom) {
      intentRef.current = { kind: 'bottom' };
    } else if (intentRef.current.kind === 'bottom') {
      intentRef.current = { kind: 'free' };
    }
  }, []);

  useEffect(() => {
    const scrollElement = scrollRef.current;
    const contentElement = contentRef.current;
    if (!scrollElement || !contentElement) return undefined;
    const resizeObserver = new ResizeObserver(() => reapply());
    resizeObserver.observe(contentElement);
    resizeObserver.observe(scrollElement);
    return () => resizeObserver.disconnect();
  }, [scrollRef, contentRef, reapply]);

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
    () => ({ pinToBottom, pinToAnchor, release, reapply, notifyAtBottomChange, intentRef }),
    [pinToBottom, pinToAnchor, release, reapply, notifyAtBottomChange]
  );
};
