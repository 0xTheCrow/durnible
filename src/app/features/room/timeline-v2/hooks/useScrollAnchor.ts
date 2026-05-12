import type { RefObject } from 'react';
import { useCallback, useEffect, useRef } from 'react';
import { computeAnchorScrollTop, type ScrollAlign } from '../../../../utils/dom';

type ScrollAnchorOptions = {
  align?: ScrollAlign;
  offset?: number;
  offsetFraction?: number;
};

type TrackedAnchor = {
  selector: string;
  align: ScrollAlign;
  offset: number;
  offsetFraction?: number;
};

type UseScrollAnchorParams = {
  scrollRef: RefObject<HTMLDivElement>;
  contentRef: RefObject<HTMLDivElement>;
};

export type SetScrollAnchor = (selector: string | null, options?: ScrollAnchorOptions) => void;

const computeOffsetPx = (tracked: TrackedAnchor, scrollEl: HTMLElement): number => {
  if (tracked.offsetFraction !== undefined) {
    return Math.round(scrollEl.clientHeight * tracked.offsetFraction);
  }
  return tracked.offset;
};

export const useScrollAnchor = ({
  scrollRef,
  contentRef,
}: UseScrollAnchorParams): SetScrollAnchor => {
  const trackedRef = useRef<TrackedAnchor | null>(null);

  const setAnchor = useCallback<SetScrollAnchor>(
    (selector, options = {}) => {
      const scrollEl = scrollRef.current;
      if (!scrollEl) return;
      if (selector === null) {
        trackedRef.current = null;
        return;
      }
      const tracked: TrackedAnchor = {
        selector,
        align: options.align ?? 'center',
        offset: options.offset ?? 0,
        offsetFraction: options.offsetFraction,
      };
      trackedRef.current = tracked;
      const targetElement = scrollEl.querySelector<HTMLElement>(selector);
      if (!targetElement) return;
      const targetRect = targetElement.getBoundingClientRect();
      const scrollRect = scrollEl.getBoundingClientRect();
      const fullyVisible =
        targetRect.top >= scrollRect.top && targetRect.bottom <= scrollRect.bottom;
      if (fullyVisible) return;
      const top = computeAnchorScrollTop(
        scrollEl,
        targetElement,
        tracked.align,
        computeOffsetPx(tracked, scrollEl)
      );
      scrollEl.scrollTo({ top, behavior: 'smooth' });
    },
    [scrollRef]
  );

  useEffect(() => {
    const scrollEl = scrollRef.current;
    const contentEl = contentRef.current;
    if (!scrollEl || !contentEl) return undefined;
    const resizeObserver = new ResizeObserver(() => {
      const tracked = trackedRef.current;
      if (!tracked) return;
      const targetElement = scrollEl.querySelector<HTMLElement>(tracked.selector);
      if (!targetElement || !targetElement.isConnected) return;
      const top = computeAnchorScrollTop(
        scrollEl,
        targetElement,
        tracked.align,
        computeOffsetPx(tracked, scrollEl)
      );
      scrollEl.scrollTo({ top, behavior: 'instant' });
    });
    resizeObserver.observe(contentEl);
    return () => resizeObserver.disconnect();
  }, [scrollRef, contentRef]);

  useEffect(() => {
    const scrollEl = scrollRef.current;
    if (!scrollEl) return undefined;
    const release = () => {
      trackedRef.current = null;
    };
    scrollEl.addEventListener('wheel', release, { passive: true });
    scrollEl.addEventListener('touchmove', release, { passive: true });
    scrollEl.addEventListener('mousedown', release);
    scrollEl.addEventListener('keydown', release);
    return () => {
      scrollEl.removeEventListener('wheel', release);
      scrollEl.removeEventListener('touchmove', release);
      scrollEl.removeEventListener('mousedown', release);
      scrollEl.removeEventListener('keydown', release);
    };
  }, [scrollRef]);

  return setAnchor;
};
