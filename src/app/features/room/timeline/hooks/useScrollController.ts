import type { RefObject } from 'react';
import { useCallback, useEffect, useMemo, useRef } from 'react';
import { computeAnchorScrollTop, type ScrollAlign } from '../../../../utils/dom';
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
  wasLatestMessageBottomInViewRef: RefObject<boolean>;
  reportLatestMessageBottomInView: () => void;
  latestMessageBottomRef: RefObject<HTMLSpanElement>;
  unfocusedAutoScrollRef: RefObject<boolean>;
};

export type ScrollController = {
  pinToLatestMessageBottom: (options?: BehaviorOptions) => void;
  pinToAnchor: (selector: string, options?: AnchorOptions, behavior?: BehaviorOptions) => void;
  haltMomentumScroll: () => void;
  release: () => void;
  checkIsLatestMessageBottomVisible: () => boolean;
  intentRef: RefObject<ScrollIntent>;
};

const ANCHOR_SATISFIED_TOLERANCE_PX = 2;
const LARGE_SCROLL_JUMP_PX = 600;

const getElementTopInScroll = (element: HTMLElement, scrollElement: HTMLElement): number =>
  element.offsetTop - scrollElement.offsetTop;

const getMaxScrollTop = (scrollElement: HTMLElement): number =>
  Math.max(0, scrollElement.scrollHeight - scrollElement.offsetHeight);

const getLatestMessageBottomScrollTop = (
  scrollElement: HTMLElement,
  contentElement: HTMLElement,
  anchorElement: HTMLElement | null
): number => {
  const maxScrollTop = getMaxScrollTop(scrollElement);
  if (!anchorElement || !anchorElement.isConnected) return maxScrollTop;
  const trailingSpacePx = parseFloat(getComputedStyle(contentElement).paddingBottom) || 0;
  const targetScrollTop =
    scrollElement.scrollTop +
    anchorElement.getBoundingClientRect().bottom +
    trailingSpacePx -
    scrollElement.getBoundingClientRect().bottom;
  return Math.min(Math.max(0, Math.round(targetScrollTop)), maxScrollTop);
};

const forceReflow = (element: HTMLElement) => {
  element.getBoundingClientRect();
};

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
  if (intent.align === 'start') {
    const targetScrollTop = computeAnchorScrollTop(
      scrollElement,
      targetElement,
      'start',
      anchorOffsetPx(intent, scrollElement)
    );
    return Math.abs(scrollElement.scrollTop - targetScrollTop) <= ANCHOR_SATISFIED_TOLERANCE_PX;
  }
  const targetRect = targetElement.getBoundingClientRect();
  const scrollRect = scrollElement.getBoundingClientRect();
  const isTopInView = targetRect.top >= scrollRect.top && targetRect.top <= scrollRect.bottom;
  return isTopInView && targetRect.bottom <= scrollRect.bottom;
};

export const useScrollController = ({
  scrollRef,
  contentRef,
  isInLivePaginationWindowRef,
  wasLatestMessageBottomInViewRef,
  reportLatestMessageBottomInView,
  latestMessageBottomRef,
  unfocusedAutoScrollRef,
}: UseScrollControllerParams): ScrollController => {
  const intentRef = useRef<ScrollIntent>({ kind: 'free' });

  const freeScrollAnchorRef = useRef<{ element: HTMLElement; viewportOffset: number } | null>(null);

  const checkIsLatestMessageBottomVisible = useCallback(
    () => !!wasLatestMessageBottomInViewRef.current && !!isInLivePaginationWindowRef.current,
    [wasLatestMessageBottomInViewRef, isInLivePaginationWindowRef]
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

  const getLatestMessageBottomTarget = useCallback((): number | null => {
    const scrollElement = scrollRef.current;
    const contentElement = contentRef.current;
    if (!scrollElement || !contentElement) return null;
    return getLatestMessageBottomScrollTop(
      scrollElement,
      contentElement,
      latestMessageBottomRef.current
    );
  }, [scrollRef, contentRef, latestMessageBottomRef]);

  const scrollToLatestMessageBottom = useCallback(
    (behavior: 'instant' | 'smooth') => {
      const scrollElement = scrollRef.current;
      const latestMessageBottomScrollTop = getLatestMessageBottomTarget();
      if (!scrollElement || latestMessageBottomScrollTop === null) return;
      const scrollTopBefore = scrollElement.scrollTop;
      scrollElement.scrollTo({ top: latestMessageBottomScrollTop, behavior });
      traceTimelineScroll('apply:scrollToLatestMessageBottom', {
        behavior,
        scrollTopBefore: Math.round(scrollTopBefore),
        latestMessageBottomScrollTop,
        maxScrollTop: getMaxScrollTop(scrollElement),
      });
    },
    [scrollRef, getLatestMessageBottomTarget]
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

  const pinToLatestMessageBottom = useCallback(
    ({ animate = false }: BehaviorOptions = {}) => {
      intentRef.current = { kind: 'free' };
      traceTimelineScroll('pinToLatestMessageBottom', { animate });
      scrollToLatestMessageBottom(animate ? 'smooth' : 'instant');
      reportLatestMessageBottomInView();
    },
    [scrollToLatestMessageBottom, reportLatestMessageBottomInView]
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

  const haltMomentumScroll = useCallback(() => {
    const scrollElement = scrollRef.current;
    if (!scrollElement) return;
    const { scrollTop } = scrollElement;
    const { overflowY } = scrollElement.style;
    traceTimelineScroll('haltMomentumScroll', { scrollTop: Math.round(scrollTop) });
    scrollElement.style.overflowY = 'hidden';
    forceReflow(scrollElement);
    scrollElement.style.overflowY = overflowY;
    scrollElement.scrollTop = scrollTop;
  }, [scrollRef]);

  const release = useCallback(() => {
    traceTimelineScroll('release', { from: intentRef.current.kind });
    intentRef.current = { kind: 'free' };
  }, []);

  useEffect(() => {
    const scrollElement = scrollRef.current;
    const contentElement = contentRef.current;
    if (!scrollElement || !contentElement) return undefined;
    let lastTickSignature: string | null = null;
    const maintainPosition = () => {
      const intent = intentRef.current;
      const tickSnapshot = {
        intent: intent.kind,
        scrollTop: Math.round(scrollElement.scrollTop),
        scrollHeight: Math.round(scrollElement.scrollHeight),
        isLatestMessageBottomVisible: checkIsLatestMessageBottomVisible(),
      };
      const tickSignature = JSON.stringify(tickSnapshot);
      if (tickSignature !== lastTickSignature) {
        lastTickSignature = tickSignature;
        traceTimelineScroll('maintainPosition:tick', tickSnapshot);
      }
      if (intent.kind === 'anchor') {
        traceTimelineScroll('maintainPosition:apply', { reason: 'anchor' });
        applyAnchor(intent, 'instant');
        return;
      }
      if (checkIsLatestMessageBottomVisible()) {
        if (!document.hasFocus() && !unfocusedAutoScrollRef.current) {
          traceTimelineScroll('maintainPosition:unfocused-skip');
          return;
        }
        traceTimelineScroll('maintainPosition:apply', { reason: 'latestMessageBottomVisible' });
        scrollToLatestMessageBottom('instant');
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
    checkIsLatestMessageBottomVisible,
    scrollToLatestMessageBottom,
    unfocusedAutoScrollRef,
    maintainFreePosition,
  ]);

  useEffect(() => {
    const scrollElement = scrollRef.current;
    if (!scrollElement) return undefined;
    let lastScrollSampleAt = 0;
    let lastLoggedScrollTop = scrollElement.scrollTop;
    const handleScroll = () => {
      const { scrollTop } = scrollElement;
      const intent = intentRef.current;
      if (intent.kind === 'anchor' && !checkIsAnchorSatisfied(intent, scrollElement)) {
        traceTimelineScroll('anchor:displaced-release', { selector: intent.selector });
        intentRef.current = { kind: 'free' };
      }
      captureFreeScrollAnchor();
      const isLargeJump = Math.abs(scrollTop - lastLoggedScrollTop) > LARGE_SCROLL_JUMP_PX;
      if (isLargeJump) {
        traceTimelineScroll('scroll:jump', {
          from: Math.round(lastLoggedScrollTop),
          to: Math.round(scrollTop),
        });
      }
      const now = performance.now();
      if (!isLargeJump && now - lastScrollSampleAt < TRACE_COALESCE_WINDOW_MS) return;
      lastScrollSampleAt = now;
      lastLoggedScrollTop = scrollTop;
      const latestMessageBottomScrollTop = getLatestMessageBottomTarget();
      traceTimelineScroll('scroll', {
        intent: intentRef.current.kind,
        isLatestMessageBottomVisible: checkIsLatestMessageBottomVisible(),
        scrollTop: Math.round(scrollTop),
        distanceToLatestMessageBottom:
          latestMessageBottomScrollTop === null
            ? null
            : Math.round(latestMessageBottomScrollTop - scrollTop),
      });
    };
    scrollElement.addEventListener('scroll', handleScroll, { passive: true });
    return () => {
      scrollElement.removeEventListener('scroll', handleScroll);
    };
  }, [
    scrollRef,
    captureFreeScrollAnchor,
    checkIsLatestMessageBottomVisible,
    getLatestMessageBottomTarget,
  ]);

  return useMemo(
    () => ({
      pinToLatestMessageBottom,
      pinToAnchor,
      haltMomentumScroll,
      release,
      checkIsLatestMessageBottomVisible,
      intentRef,
    }),
    [
      pinToLatestMessageBottom,
      pinToAnchor,
      haltMomentumScroll,
      release,
      checkIsLatestMessageBottomVisible,
    ]
  );
};
