import type { RefObject } from 'react';
import { useEffect, useRef, useState } from 'react';

type UseIsNewestMessageVisibleParams = {
  scrollRef: RefObject<HTMLDivElement>;
};

type UseIsNewestMessageVisibleResult = {
  isNewestMessageVisible: boolean;
  isNewestMessageVisibleRef: RefObject<boolean>;
  newestMessageAnchorRef: RefObject<HTMLSpanElement>;
};

export const NEWEST_MESSAGE_TOLERANCE_PX = 8;

export const useIsNewestMessageVisible = ({
  scrollRef,
}: UseIsNewestMessageVisibleParams): UseIsNewestMessageVisibleResult => {
  const [isNewestMessageVisible, setIsNewestMessageVisible] = useState(false);
  const isNewestMessageVisibleRef = useRef(false);
  const newestMessageAnchorRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const anchorElement = newestMessageAnchorRef.current;
    const root = scrollRef.current;
    if (!anchorElement || !root) return undefined;

    const observer = new IntersectionObserver(
      ([entry]) => {
        const { isIntersecting } = entry;
        isNewestMessageVisibleRef.current = isIntersecting;
        setIsNewestMessageVisible(isIntersecting);
      },
      { root, rootMargin: `0px 0px ${NEWEST_MESSAGE_TOLERANCE_PX}px 0px`, threshold: 0 }
    );
    observer.observe(anchorElement);

    return () => {
      observer.disconnect();
    };
  }, [scrollRef]);

  return { isNewestMessageVisible, isNewestMessageVisibleRef, newestMessageAnchorRef };
};
