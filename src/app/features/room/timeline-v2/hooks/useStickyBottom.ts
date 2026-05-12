import type { RefObject } from 'react';
import { useCallback } from 'react';
import { useResizeObserver } from '../../../../hooks/useResizeObserver';
import { scrollToBottom } from '../../../../utils/dom';

type UseStickyBottomParams = {
  scrollRef: RefObject<HTMLDivElement>;
  contentRef: RefObject<HTMLDivElement>;
};

export const useStickyBottom = ({ scrollRef, contentRef }: UseStickyBottomParams): void => {
  const reanchor = useCallback(() => {
    const scrollEl = scrollRef.current;
    if (!scrollEl) return;
    const isAtBottomNow = scrollEl.scrollTop + scrollEl.clientHeight >= scrollEl.scrollHeight - 1;
    if (!isAtBottomNow) return;
    scrollToBottom(scrollEl);
  }, [scrollRef]);

  const getContentElement = useCallback(() => contentRef.current, [contentRef]);
  const getScrollElement = useCallback(() => scrollRef.current, [scrollRef]);

  useResizeObserver(reanchor, getContentElement);
  useResizeObserver(reanchor, getScrollElement);
};
