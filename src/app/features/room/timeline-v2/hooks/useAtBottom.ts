import type { RefObject } from 'react';
import { useEffect, useRef, useState } from 'react';

type UseAtBottomParams = {
  scrollRef: RefObject<HTMLDivElement>;
};

type UseAtBottomResult = {
  atBottom: boolean;
  atBottomRef: RefObject<boolean>;
  atBottomAnchorRef: RefObject<HTMLSpanElement>;
};

export const useAtBottom = ({ scrollRef }: UseAtBottomParams): UseAtBottomResult => {
  const [atBottom, setAtBottom] = useState(false);
  const atBottomRef = useRef(false);
  const atBottomAnchorRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const sentinel = atBottomAnchorRef.current;
    const root = scrollRef.current;
    if (!sentinel || !root) return undefined;

    const observer = new IntersectionObserver(
      ([entry]) => {
        const isIntersecting = entry.isIntersecting;
        atBottomRef.current = isIntersecting;
        setAtBottom(isIntersecting);
      },
      { root, rootMargin: '0px', threshold: 0 }
    );
    observer.observe(sentinel);

    return () => {
      observer.disconnect();
    };
  }, [scrollRef]);

  return { atBottom, atBottomRef, atBottomAnchorRef };
};
