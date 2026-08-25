import type { RefObject } from 'react';
import { useCallback, useEffect, useMemo, useRef } from 'react';
import {
  computeAnchorScrollTop,
  getScrollBottomDistance,
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

export type ScrollIntent = { kind: 'free' } | { kind: 'latestMessageBottom' } | AnchorIntent;

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
  latestMessageBottomRef: RefObject<HTMLSpanElement>;
  unfocusedAutoScrollRef: RefObject<boolean>;
};

export type ScrollController = {
  pinToLatestMessageBottom: (options?: BehaviorOptions) => void;
  pinToAnchor: (selector: string, options?: AnchorOptions, behavior?: BehaviorOptions) => void;
  haltMomentumScroll: () => void;
  release: () => void;
  releaseLatestMessageBottomFollow: () => void;
  syncLatestMessageBottomFollow: (isVisible: boolean) => void;
  intentRef: RefObject<ScrollIntent>;
};

const AUTO_SCROLL_FALLBACK_MS = 1000;
const ANCHOR_SATISFIED_TOLERANCE_PX = 2;
const LARGE_SCROLL_JUMP_PX = 600;

export const LATEST_MESSAGE_BOTTOM_RELEASE_THRESHOLD_PX = 20;

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
  const targetRect = targetElement.getBoundingClientRect();
  const scrollRect = scrollElement.getBoundingClientRect();
  if (intent.align === 'start') {
    const offset = anchorOffsetPx(intent, scrollElement);
    return Math.abs(targetRect.top - (scrollRect.top + offset)) <= ANCHOR_SATISFIED_TOLERANCE_PX;
  }
  const isTopInView = targetRect.top >= scrollRect.top && targetRect.top <= scrollRect.bottom;
  return isTopInView && targetRect.bottom <= scrollRect.bottom;
};

const getTopVisibleMessageId = (scrollElement: HTMLElement): string | null => {
  const scrollRect = scrollElement.getBoundingClientRect();
  const rows = scrollElement.querySelectorAll<HTMLElement>('[data-message-id]');
  for (let i = 0; i < rows.length; i += 1) {
    const row = rows[i];
    if (row.getBoundingClientRect().bottom > scrollRect.top) {
      return row.getAttribute('data-message-id');
    }
  }
  return null;
};

export const useScrollController = ({
  scrollRef,
  contentRef,
  isInLivePaginationWindowRef,
  latestMessageBottomRef,
  unfocusedAutoScrollRef,
}: UseScrollControllerParams): ScrollController => {
  const intentRef = useRef<ScrollIntent>({ kind: 'free' });
  const autoScrollingRef = useRef(false);
  const autoScrollTimerRef = useRef(0);
  const userScrollSinceBottomRef = useRef(false);
  const wasLatestMessageBottomInViewRef = useRef(false);

  const freeScrollAnchorRef = useRef<{ element: HTMLElement; viewportOffset: number } | null>(null);

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

  const beginAutoScroll = useCallback(() => {
    autoScrollingRef.current = true;
    window.clearTimeout(autoScrollTimerRef.current);
    autoScrollTimerRef.current = window.setTimeout(() => {
      autoScrollingRef.current = false;
    }, AUTO_SCROLL_FALLBACK_MS);
  }, []);

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

  const apply = useCallback(
    (behavior: 'instant' | 'smooth') => {
      const intent = intentRef.current;
      if (intent.kind === 'free') return;
      if (intent.kind === 'latestMessageBottom') {
        scrollToLatestMessageBottom(behavior);
        return;
      }
      applyAnchor(intent, behavior);
    },
    [scrollToLatestMessageBottom, applyAnchor]
  );

  const pinToLatestMessageBottom = useCallback(
    ({ animate = false }: BehaviorOptions = {}) => {
      intentRef.current = { kind: 'latestMessageBottom' };
      userScrollSinceBottomRef.current = false;
      beginAutoScroll();
      traceTimelineScroll('pinToLatestMessageBottom', { animate });
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
      traceTimelineScroll('pinToAnchor', { selector, align: intentRef.current.align, animate });
      apply(animate ? 'smooth' : 'instant');
    },
    [apply, beginAutoScroll]
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

  const releaseLatestMessageBottomFollow = useCallback(() => {
    if (intentRef.current.kind === 'latestMessageBottom') {
      traceTimelineScroll('releaseLatestMessageBottomFollow');
      intentRef.current = { kind: 'free' };
    }
  }, []);

  const syncLatestMessageBottomFollow = useCallback(
    (isVisible: boolean) => {
      wasLatestMessageBottomInViewRef.current = isVisible;
      if (isVisible) userScrollSinceBottomRef.current = false;
      const scrollElement = scrollRef.current;
      traceTimelineScroll('syncLatestMessageBottomFollow:report', {
        isVisible,
        intent: intentRef.current.kind,
        isInLivePaginationWindow: isInLivePaginationWindowRef.current,
        scrollBottomDistance: scrollElement
          ? Math.round(getScrollBottomDistance(scrollElement))
          : null,
      });
      if (autoScrollingRef.current) {
        traceTimelineScroll('syncLatestMessageBottomFollow:autoScrolling-skip', { isVisible });
        return;
      }
      if (isVisible && isInLivePaginationWindowRef.current) {
        if (intentRef.current.kind !== 'latestMessageBottom') {
          traceTimelineScroll('latestMessageBottomFollow:set');
          intentRef.current = { kind: 'latestMessageBottom' };
        }
      } else if (intentRef.current.kind === 'latestMessageBottom') {
        const scrollBottomDistance = scrollElement ? getScrollBottomDistance(scrollElement) : null;
        const isDriftUserDriven = userScrollSinceBottomRef.current;
        if (
          isDriftUserDriven &&
          (scrollBottomDistance === null ||
            scrollBottomDistance > LATEST_MESSAGE_BOTTOM_RELEASE_THRESHOLD_PX)
        ) {
          traceTimelineScroll('latestMessageBottomFollow:release', {
            isVisible,
            scrollBottomDistance,
          });
          intentRef.current = { kind: 'free' };
        } else {
          traceTimelineScroll('latestMessageBottomFollow:release-skipped', {
            isVisible,
            scrollBottomDistance,
            isDriftUserDriven,
          });
        }
      }
    },
    [isInLivePaginationWindowRef, scrollRef]
  );

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
      };
      const tickSignature = JSON.stringify(tickSnapshot);
      if (tickSignature !== lastTickSignature) {
        lastTickSignature = tickSignature;
        traceTimelineScroll('maintainPosition:tick', tickSnapshot);
      }
      if (intent.kind === 'free') {
        maintainFreePosition();
        return;
      }
      if (
        intent.kind === 'latestMessageBottom' &&
        !document.hasFocus() &&
        !unfocusedAutoScrollRef.current
      ) {
        traceTimelineScroll('maintainPosition:unfocused-skip');
        return;
      }
      traceTimelineScroll('maintainPosition:apply', { intent: intent.kind });
      apply('instant');
    };
    const resizeObserver = new ResizeObserver(maintainPosition);
    resizeObserver.observe(contentElement);
    resizeObserver.observe(scrollElement);
    return () => resizeObserver.disconnect();
  }, [scrollRef, contentRef, apply, unfocusedAutoScrollRef, maintainFreePosition]);

  useEffect(() => {
    const scrollElement = scrollRef.current;
    if (!scrollElement) return undefined;
    const endAutoScroll = () => {
      autoScrollingRef.current = false;
      window.clearTimeout(autoScrollTimerRef.current);
    };
    const scrollStateDetail = () => ({
      intent: intentRef.current.kind,
      scrollBottomDistance: Math.round(getScrollBottomDistance(scrollElement)),
      wasLatestMessageBottomInView: !!wasLatestMessageBottomInViewRef.current,
    });
    const handleUserInput = (event: Event) => {
      userScrollSinceBottomRef.current = true;
      traceTimelineScroll('userInput', { type: event.type, focused: document.hasFocus() });
      const intent = intentRef.current;
      if (intent.kind === 'anchor') {
        const resumeFollow =
          !!wasLatestMessageBottomInViewRef.current && !!isInLivePaginationWindowRef.current;
        traceTimelineScroll('anchor:user-release', { resumeFollow });
        intentRef.current = resumeFollow ? { kind: 'latestMessageBottom' } : { kind: 'free' };
      } else if (intent.kind === 'latestMessageBottom') {
        const scrollBottomDistance = getScrollBottomDistance(scrollElement);
        if (scrollBottomDistance > LATEST_MESSAGE_BOTTOM_RELEASE_THRESHOLD_PX) {
          traceTimelineScroll('latestMessageBottomFollow:release-on-input', {
            type: event.type,
            scrollBottomDistance: Math.round(scrollBottomDistance),
          });
          intentRef.current = { kind: 'free' };
        }
      }
      endAutoScroll();
    };
    let lastScrollSampleAt = 0;
    let lastLoggedScrollTop = scrollElement.scrollTop;
    let lastLoggedTopVisibleMessageId = getTopVisibleMessageId(scrollElement);
    const handleScroll = () => {
      captureFreeScrollAnchor();
      if (!autoScrollingRef.current) {
        userScrollSinceBottomRef.current = true;
      }
      if (
        userScrollSinceBottomRef.current &&
        intentRef.current.kind === 'latestMessageBottom' &&
        getScrollBottomDistance(scrollElement) > LATEST_MESSAGE_BOTTOM_RELEASE_THRESHOLD_PX
      ) {
        intentRef.current = { kind: 'free' };
      }
      const { scrollTop } = scrollElement;
      const isLargeJump = Math.abs(scrollTop - lastLoggedScrollTop) > LARGE_SCROLL_JUMP_PX;
      const topVisibleMessageId = getTopVisibleMessageId(scrollElement);
      if (isLargeJump) {
        traceTimelineScroll('scroll:jump', {
          from: Math.round(lastLoggedScrollTop),
          to: Math.round(scrollTop),
          topVisibleMessageIdBefore: lastLoggedTopVisibleMessageId,
          topVisibleMessageIdAfter: topVisibleMessageId,
        });
      }
      lastLoggedTopVisibleMessageId = topVisibleMessageId;
      const now = performance.now();
      if (!isLargeJump && now - lastScrollSampleAt < TRACE_COALESCE_WINDOW_MS) return;
      lastScrollSampleAt = now;
      lastLoggedScrollTop = scrollTop;
      traceTimelineScroll('scroll', {
        ...scrollStateDetail(),
        scrollTop: Math.round(scrollTop),
        topVisibleMessageId,
      });
    };
    const handleScrollEnd = () => {
      traceTimelineScroll('scrollEnd', scrollStateDetail());
      endAutoScroll();
    };
    scrollElement.addEventListener('wheel', handleUserInput, { passive: true });
    scrollElement.addEventListener('touchmove', handleUserInput, { passive: true });
    scrollElement.addEventListener('mousedown', handleUserInput);
    scrollElement.addEventListener('keydown', handleUserInput);
    scrollElement.addEventListener('scroll', handleScroll, { passive: true });
    scrollElement.addEventListener('scrollend', handleScrollEnd);
    return () => {
      scrollElement.removeEventListener('wheel', handleUserInput);
      scrollElement.removeEventListener('touchmove', handleUserInput);
      scrollElement.removeEventListener('mousedown', handleUserInput);
      scrollElement.removeEventListener('keydown', handleUserInput);
      scrollElement.removeEventListener('scroll', handleScroll);
      scrollElement.removeEventListener('scrollend', handleScrollEnd);
    };
  }, [scrollRef, isInLivePaginationWindowRef, captureFreeScrollAnchor]);

  return useMemo(
    () => ({
      pinToLatestMessageBottom,
      pinToAnchor,
      haltMomentumScroll,
      release,
      releaseLatestMessageBottomFollow,
      syncLatestMessageBottomFollow,
      intentRef,
    }),
    [
      pinToLatestMessageBottom,
      pinToAnchor,
      haltMomentumScroll,
      release,
      releaseLatestMessageBottomFollow,
      syncLatestMessageBottomFollow,
    ]
  );
};
