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
      apply(animate ? 'smooth' : 'instant');
    },
    [apply]
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
      apply(animate ? 'smooth' : 'instant');
    },
    [apply]
  );

  const release = useCallback(() => {
    intentRef.current = { kind: 'free' };
  }, []);

  const releaseFollowLive = useCallback(() => {
    if (intentRef.current.kind === 'followLive') intentRef.current = { kind: 'free' };
  }, []);

  const syncFollowLive = useCallback(
    (atBottom: boolean) => {
      if (atBottom && isInLivePaginationWindowRef.current) {
        intentRef.current = { kind: 'followLive' };
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
    const releaseIntent = () => {
      if (intentRef.current.kind !== 'free') intentRef.current = { kind: 'free' };
    };
    const releaseAnchor = () => {
      if (intentRef.current.kind === 'anchor') intentRef.current = { kind: 'free' };
    };
    scrollElement.addEventListener('wheel', releaseIntent, { passive: true });
    scrollElement.addEventListener('touchmove', releaseIntent, { passive: true });
    scrollElement.addEventListener('keydown', releaseIntent);
    scrollElement.addEventListener('mousedown', releaseAnchor);
    return () => {
      scrollElement.removeEventListener('wheel', releaseIntent);
      scrollElement.removeEventListener('touchmove', releaseIntent);
      scrollElement.removeEventListener('keydown', releaseIntent);
      scrollElement.removeEventListener('mousedown', releaseAnchor);
    };
  }, [scrollRef]);

  return useMemo(
    () => ({ pinToLiveEnd, pinToAnchor, release, releaseFollowLive, syncFollowLive, intentRef }),
    [pinToLiveEnd, pinToAnchor, release, releaseFollowLive, syncFollowLive]
  );
};
