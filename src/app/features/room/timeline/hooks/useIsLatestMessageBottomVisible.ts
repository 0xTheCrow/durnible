import type { RefObject } from 'react';
import { useEffect, useRef, useState } from 'react';

type UseIsLatestMessageBottomVisibleParams = {
  scrollRef: RefObject<HTMLDivElement>;
  latestMessageBottomRef: RefObject<HTMLSpanElement>;
  isInLivePaginationWindow: boolean;
  onChange?: (isVisible: boolean) => void;
};

type UseIsLatestMessageBottomVisibleResult = {
  isLatestMessageBottomVisible: boolean;
  wasLatestMessageBottomInViewRef: RefObject<boolean>;
};

export const LATEST_MESSAGE_BOTTOM_TOLERANCE_PX = 8;

export const useIsLatestMessageBottomVisible = ({
  scrollRef,
  latestMessageBottomRef,
  isInLivePaginationWindow,
  onChange,
}: UseIsLatestMessageBottomVisibleParams): UseIsLatestMessageBottomVisibleResult => {
  const [isRenderedBottomVisible, setIsRenderedBottomVisible] = useState(false);
  const wasLatestMessageBottomInViewRef = useRef(false);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  useEffect(() => {
    const anchorElement = latestMessageBottomRef.current;
    const root = scrollRef.current;
    if (!anchorElement || !root) return undefined;

    const observer = new IntersectionObserver(
      ([entry]) => {
        wasLatestMessageBottomInViewRef.current = entry.isIntersecting;
        setIsRenderedBottomVisible(entry.isIntersecting);
        onChangeRef.current?.(entry.isIntersecting);
      },
      { root, rootMargin: `0px 0px ${LATEST_MESSAGE_BOTTOM_TOLERANCE_PX}px 0px`, threshold: 0 }
    );
    observer.observe(anchorElement);

    return () => {
      observer.disconnect();
    };
  }, [scrollRef, latestMessageBottomRef]);

  return {
    isLatestMessageBottomVisible: isRenderedBottomVisible && isInLivePaginationWindow,
    wasLatestMessageBottomInViewRef,
  };
};
