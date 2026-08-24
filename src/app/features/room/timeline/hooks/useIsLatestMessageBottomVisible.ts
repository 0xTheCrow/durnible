import type { RefObject } from 'react';
import { useEffect, useRef, useState } from 'react';

type UseIsLatestMessageBottomVisibleParams = {
  scrollRef: RefObject<HTMLDivElement>;
  isInLivePaginationWindow: boolean;
};

type UseIsLatestMessageBottomVisibleResult = {
  isLatestMessageBottomVisible: boolean;
  latestMessageBottomRef: RefObject<HTMLSpanElement>;
};

export const LATEST_MESSAGE_BOTTOM_TOLERANCE_PX = 8;

export const useIsLatestMessageBottomVisible = ({
  scrollRef,
  isInLivePaginationWindow,
}: UseIsLatestMessageBottomVisibleParams): UseIsLatestMessageBottomVisibleResult => {
  const [isRenderedBottomVisible, setIsRenderedBottomVisible] = useState(false);
  const latestMessageBottomRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const anchorElement = latestMessageBottomRef.current;
    const root = scrollRef.current;
    if (!anchorElement || !root) return undefined;

    const observer = new IntersectionObserver(
      ([entry]) => {
        setIsRenderedBottomVisible(entry.isIntersecting);
      },
      { root, rootMargin: `0px 0px ${LATEST_MESSAGE_BOTTOM_TOLERANCE_PX}px 0px`, threshold: 0 }
    );
    observer.observe(anchorElement);

    return () => {
      observer.disconnect();
    };
  }, [scrollRef]);

  return {
    isLatestMessageBottomVisible: isRenderedBottomVisible && isInLivePaginationWindow,
    latestMessageBottomRef,
  };
};
