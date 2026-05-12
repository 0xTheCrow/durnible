import type { RefObject } from 'react';
import { useEffect, useRef, useState } from 'react';

type UseNearBottomParams = {
  scrollRef: RefObject<HTMLDivElement>;
};

type UseNearBottomResult = {
  nearBottom: boolean;
  nearBottomRef: RefObject<boolean>;
  nearBottomAnchorRef: RefObject<HTMLSpanElement>;
};

export const useNearBottom = ({ scrollRef }: UseNearBottomParams): UseNearBottomResult => {
  const [nearBottom, setNearBottom] = useState(false);
  const nearBottomRef = useRef(false);
  const nearBottomAnchorRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const sentinel = nearBottomAnchorRef.current;
    const root = scrollRef.current;
    if (!sentinel || !root) return undefined;

    const observer = new IntersectionObserver(
      ([entry]) => {
        const isIntersecting = entry.isIntersecting;
        nearBottomRef.current = isIntersecting;
        setNearBottom(isIntersecting);
      },
      { root, rootMargin: '0px 0px 100px 0px', threshold: 0 }
    );
    observer.observe(sentinel);

    return () => {
      observer.disconnect();
    };
  }, [scrollRef]);

  return { nearBottom, nearBottomRef, nearBottomAnchorRef };
};
