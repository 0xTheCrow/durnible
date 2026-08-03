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

export const LIVE_EDGE_THRESHOLD_PX = 20;

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
  const lastReportedAtBottomRef = useRef(false);
  const userScrollSinceBottomRef = useRef(false);

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
        const scrollTopBefore = scrollElement.scrollTop;
        scrollToBottom(scrollElement, behavior);
        traceTimelineScroll('apply:scrollToBottom', {
          behavior,
          scrollTopBefore: Math.round(scrollTopBefore),
          scrollTopAfter: Math.round(scrollElement.scrollTop),
          scrollHeight: scrollElement.scrollHeight,
          offsetHeight: scrollElement.offsetHeight,
        });
        return;
      }
      const targetElement = scrollElement.querySelector<HTMLElement>(intent.selector);
      if (!targetElement || !targetElement.isConnected) {
        traceTimelineScroll('apply:anchor-missing', { selector: intent.selector });
        return;
      }
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
      userScrollSinceBottomRef.current = false;
      beginAutoScroll();
      traceTimelineScroll('pinToLiveEnd', { animate });
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

  const release = useCallback(() => {
    traceTimelineScroll('release', { from: intentRef.current.kind });
    intentRef.current = { kind: 'free' };
  }, []);

  const releaseFollowLive = useCallback(() => {
    if (intentRef.current.kind === 'followLive') {
      traceTimelineScroll('releaseFollowLive');
      intentRef.current = { kind: 'free' };
    }
  }, []);

  const syncFollowLive = useCallback(
    (atBottom: boolean) => {
      lastReportedAtBottomRef.current = atBottom;
      if (atBottom) userScrollSinceBottomRef.current = false;
      const reportScrollElement = scrollRef.current;
      traceTimelineScroll('atBottom:report', {
        atBottom,
        intent: intentRef.current.kind,
        isInLivePaginationWindow: isInLivePaginationWindowRef.current,
        scrollBottomDistance: reportScrollElement
          ? Math.round(getScrollBottomDistance(reportScrollElement))
          : null,
      });
      if (autoScrollingRef.current) {
        traceTimelineScroll('syncFollowLive:autoScrolling-skip', { atBottom });
        return;
      }
      if (atBottom && isInLivePaginationWindowRef.current) {
        if (intentRef.current.kind !== 'followLive') {
          traceTimelineScroll('followLive:set');
          intentRef.current = { kind: 'followLive' };
        }
      } else if (intentRef.current.kind === 'followLive') {
        const scrollElement = scrollRef.current;
        const scrollBottomDistance = scrollElement ? getScrollBottomDistance(scrollElement) : null;
        const isDriftUserDriven = userScrollSinceBottomRef.current;
        if (
          isDriftUserDriven &&
          (scrollBottomDistance === null || scrollBottomDistance > LIVE_EDGE_THRESHOLD_PX)
        ) {
          traceTimelineScroll('followLive:release', { atBottom, scrollBottomDistance });
          intentRef.current = { kind: 'free' };
        } else {
          traceTimelineScroll('followLive:release-skipped', {
            atBottom,
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
    const maintainPosition = () => {
      if (intentRef.current.kind === 'free') return;
      if (
        intentRef.current.kind === 'followLive' &&
        !document.hasFocus() &&
        !unfocusedAutoScrollRef.current
      ) {
        traceTimelineScroll('maintainPosition:unfocused-skip');
        return;
      }
      traceTimelineScroll('maintainPosition:apply', { intent: intentRef.current.kind });
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
    const scrollStateDetail = () => ({
      intent: intentRef.current.kind,
      scrollBottomDistance: Math.round(getScrollBottomDistance(scrollElement)),
      lastReportedAtBottom: lastReportedAtBottomRef.current,
    });
    const handleUserInput = (event: Event) => {
      userScrollSinceBottomRef.current = true;
      traceTimelineScroll('userInput', { type: event.type, focused: document.hasFocus() });
      const intent = intentRef.current;
      if (intent.kind === 'anchor') {
        const resumeFollowLive =
          lastReportedAtBottomRef.current && isInLivePaginationWindowRef.current;
        traceTimelineScroll('anchor:user-release', { resumeFollowLive });
        intentRef.current = resumeFollowLive ? { kind: 'followLive' } : { kind: 'free' };
      } else if (intent.kind === 'followLive') {
        const scrollBottomDistance = getScrollBottomDistance(scrollElement);
        if (scrollBottomDistance > LIVE_EDGE_THRESHOLD_PX) {
          traceTimelineScroll('followLive:release-on-input', {
            type: event.type,
            scrollBottomDistance: Math.round(scrollBottomDistance),
          });
          intentRef.current = { kind: 'free' };
        }
      }
      endAutoScroll();
    };
    let lastScrollSampleAt = 0;
    const handleScroll = () => {
      const now = performance.now();
      if (now - lastScrollSampleAt < TRACE_COALESCE_WINDOW_MS) return;
      lastScrollSampleAt = now;
      traceTimelineScroll('scroll', scrollStateDetail());
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
  }, [scrollRef, isInLivePaginationWindowRef]);

  return useMemo(
    () => ({ pinToLiveEnd, pinToAnchor, release, releaseFollowLive, syncFollowLive, intentRef }),
    [pinToLiveEnd, pinToAnchor, release, releaseFollowLive, syncFollowLive]
  );
};
