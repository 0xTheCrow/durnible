import type { RefObject } from 'react';
import { useCallback, useEffect, useMemo, useRef } from 'react';
import {
  computeAnchorScrollTop,
  getScrollBottomDistance,
  scrollToBottom,
  type ScrollAlign,
} from '../../../../utils/dom';
import { traceTimelineScroll, TRACE_COALESCE_WINDOW_MS } from '../utils/scrollTrace';

type AnchorIntent = {
  kind: 'anchor';
  selector: string;
  align: ScrollAlign;
  offset: number;
  offsetFraction?: number;
};

export type ScrollIntent = { kind: 'free' } | AnchorIntent;

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
  isNewestMessageVisibleRef: RefObject<boolean>;
  unfocusedAutoScrollRef: RefObject<boolean>;
};

export type ScrollController = {
  pinToLiveEnd: (options?: BehaviorOptions) => void;
  pinToAnchor: (selector: string, options?: AnchorOptions, behavior?: BehaviorOptions) => void;
  release: () => void;
  checkIsAtLiveEdge: () => boolean;
  intentRef: RefObject<ScrollIntent>;
};

const ANCHOR_SATISFIED_TOLERANCE_PX = 2;

const getElementTopInScroll = (element: HTMLElement, scrollElement: HTMLElement): number =>
  element.offsetTop - scrollElement.offsetTop;

const anchorOffsetPx = (intent: AnchorIntent, scrollElement: HTMLElement): number =>
  intent.offsetFraction !== undefined
    ? Math.round(scrollElement.clientHeight * intent.offsetFraction)
    : intent.offset;

const findAnchorElement = (
  intent: AnchorIntent,
  scrollElement: HTMLElement
): HTMLElement | null => {
  const targetElement = scrollElement.querySelector<HTMLElement>(intent.selector);
  return targetElement && targetElement.isConnected ? targetElement : null;
};

const checkIsAnchorSatisfied = (intent: AnchorIntent, scrollElement: HTMLElement): boolean => {
  const targetElement = findAnchorElement(intent, scrollElement);
  if (!targetElement) return true;
  const targetRect = targetElement.getBoundingClientRect();
  const scrollRect = scrollElement.getBoundingClientRect();
  if (intent.align === 'start') {
    const offset = anchorOffsetPx(intent, scrollElement);
    return Math.abs(targetRect.top - (scrollRect.top + offset)) <= ANCHOR_SATISFIED_TOLERANCE_PX;
  }
  const isTopInView = targetRect.top >= scrollRect.top && targetRect.top <= scrollRect.bottom;
  return isTopInView && targetRect.bottom <= scrollRect.bottom;
};

export const useScrollController = ({
  scrollRef,
  contentRef,
  isInLivePaginationWindowRef,
  isNewestMessageVisibleRef,
  unfocusedAutoScrollRef,
}: UseScrollControllerParams): ScrollController => {
  const intentRef = useRef<ScrollIntent>({ kind: 'free' });

  const freeScrollAnchorRef = useRef<{ element: HTMLElement; viewportOffset: number } | null>(null);

  const checkIsAtLiveEdge = useCallback(
    () => !!isNewestMessageVisibleRef.current && !!isInLivePaginationWindowRef.current,
    [isNewestMessageVisibleRef, isInLivePaginationWindowRef]
  );

  const captureFreeScrollAnchor = useCallback(() => {
    freeScrollAnchorRef.current = null;
    const scrollElement = scrollRef.current;
    const contentElement = contentRef.current;
    if (!scrollElement || !contentElement) return;
    const { scrollTop } = scrollElement;
    const rowElements = contentElement.children;
    for (let i = 0; i < rowElements.length; i += 1) {
      const rowElement = rowElements[i] as HTMLElement;
      const rowTop = getElementTopInScroll(rowElement, scrollElement);
      if (rowTop + rowElement.offsetHeight > scrollTop) {
        freeScrollAnchorRef.current = { element: rowElement, viewportOffset: rowTop - scrollTop };
        return;
      }
    }
  }, [scrollRef, contentRef]);

  const maintainFreePosition = useCallback(() => {
    const scrollElement = scrollRef.current;
    if (!scrollElement) return;
    const freeScrollAnchor = freeScrollAnchorRef.current;
    if (!freeScrollAnchor || !freeScrollAnchor.element.isConnected) {
      captureFreeScrollAnchor();
      return;
    }
    const targetScrollTop =
      getElementTopInScroll(freeScrollAnchor.element, scrollElement) -
      freeScrollAnchor.viewportOffset;
    if (targetScrollTop === scrollElement.scrollTop) return;
    traceTimelineScroll('maintainPosition:free-apply', {
      scrollTopBefore: Math.round(scrollElement.scrollTop),
      targetScrollTop: Math.round(targetScrollTop),
    });
    scrollElement.scrollTo({ top: targetScrollTop, behavior: 'instant' });
  }, [scrollRef, captureFreeScrollAnchor]);

  const scrollToLiveEnd = useCallback(
    (behavior: 'instant' | 'smooth') => {
      const scrollElement = scrollRef.current;
      if (!scrollElement) return;
      const scrollTopBefore = scrollElement.scrollTop;
      scrollToBottom(scrollElement, behavior);
      traceTimelineScroll('apply:scrollToBottom', {
        behavior,
        scrollTopBefore: Math.round(scrollTopBefore),
        scrollTopAfter: Math.round(scrollElement.scrollTop),
        scrollHeight: scrollElement.scrollHeight,
        offsetHeight: scrollElement.offsetHeight,
      });
    },
    [scrollRef]
  );

  const applyAnchor = useCallback(
    (intent: AnchorIntent, behavior: 'instant' | 'smooth') => {
      const scrollElement = scrollRef.current;
      if (!scrollElement) return;
      const targetElement = findAnchorElement(intent, scrollElement);
      if (!targetElement) {
        traceTimelineScroll('apply:anchor-missing', { selector: intent.selector });
        return;
      }
      if (checkIsAnchorSatisfied(intent, scrollElement)) return;
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

  const pinToLiveEnd = useCallback(
    ({ animate = false }: BehaviorOptions = {}) => {
      intentRef.current = { kind: 'free' };
      traceTimelineScroll('pinToLiveEnd', { animate });
      scrollToLiveEnd(animate ? 'smooth' : 'instant');
    },
    [scrollToLiveEnd]
  );

  const pinToAnchor = useCallback(
    (selector: string, options: AnchorOptions = {}, { animate = false }: BehaviorOptions = {}) => {
      const intent: AnchorIntent = {
        kind: 'anchor',
        selector,
        align: options.align ?? 'center',
        offset: options.offset ?? 0,
        offsetFraction: options.offsetFraction,
      };
      intentRef.current = intent;
      traceTimelineScroll('pinToAnchor', { selector, align: intent.align, animate });
      applyAnchor(intent, animate ? 'smooth' : 'instant');
    },
    [applyAnchor]
  );

  const release = useCallback(() => {
    traceTimelineScroll('release', { from: intentRef.current.kind });
    intentRef.current = { kind: 'free' };
  }, []);

  useEffect(() => {
    const scrollElement = scrollRef.current;
    const contentElement = contentRef.current;
    if (!scrollElement || !contentElement) return undefined;
    const maintainPosition = () => {
      const intent = intentRef.current;
      if (intent.kind === 'anchor') {
        traceTimelineScroll('maintainPosition:apply', { intent: intent.kind });
        applyAnchor(intent, 'instant');
        return;
      }
      if (checkIsAtLiveEdge()) {
        if (!document.hasFocus() && !unfocusedAutoScrollRef.current) {
          traceTimelineScroll('maintainPosition:unfocused-skip');
          return;
        }
        traceTimelineScroll('maintainPosition:apply', { intent: 'liveEdge' });
        scrollToLiveEnd('instant');
        return;
      }
      maintainFreePosition();
    };
    const resizeObserver = new ResizeObserver(maintainPosition);
    resizeObserver.observe(contentElement);
    resizeObserver.observe(scrollElement);
    return () => resizeObserver.disconnect();
  }, [
    scrollRef,
    contentRef,
    applyAnchor,
    checkIsAtLiveEdge,
    scrollToLiveEnd,
    unfocusedAutoScrollRef,
    maintainFreePosition,
  ]);

  useEffect(() => {
    const scrollElement = scrollRef.current;
    if (!scrollElement) return undefined;
    let lastScrollSampleAt = 0;
    const handleScroll = () => {
      const intent = intentRef.current;
      if (intent.kind === 'anchor' && !checkIsAnchorSatisfied(intent, scrollElement)) {
        traceTimelineScroll('anchor:displaced-release', { selector: intent.selector });
        intentRef.current = { kind: 'free' };
      }
      captureFreeScrollAnchor();
      const now = performance.now();
      if (now - lastScrollSampleAt < TRACE_COALESCE_WINDOW_MS) return;
      lastScrollSampleAt = now;
      traceTimelineScroll('scroll', {
        intent: intentRef.current.kind,
        isAtLiveEdge: checkIsAtLiveEdge(),
        scrollBottomDistance: Math.round(getScrollBottomDistance(scrollElement)),
      });
    };
    scrollElement.addEventListener('scroll', handleScroll, { passive: true });
    return () => {
      scrollElement.removeEventListener('scroll', handleScroll);
    };
  }, [scrollRef, captureFreeScrollAnchor, checkIsAtLiveEdge]);

  return useMemo(
    () => ({ pinToLiveEnd, pinToAnchor, release, checkIsAtLiveEdge, intentRef }),
    [pinToLiveEnd, pinToAnchor, release, checkIsAtLiveEdge]
  );
};
