import type { RefObject } from 'react';
import { useCallback, useLayoutEffect, useState } from 'react';
import type { CallTileGridLayout } from '../../utils/call';
import { getCallTileGridLayout } from '../../utils/call';
import { useElementSizeObserver } from '../useElementSizeObserver';

export const useCallTileGridLayout = (
  containerRef: RefObject<HTMLElement>,
  tileCount: number
): CallTileGridLayout => {
  const [containerSize, setContainerSize] = useState({ width: 0, height: 0 });

  useLayoutEffect(() => {
    const containerElement = containerRef.current;
    if (containerElement) {
      setContainerSize({
        width: containerElement.clientWidth,
        height: containerElement.clientHeight,
      });
    }
  }, [containerRef]);

  useElementSizeObserver(
    useCallback(() => containerRef.current, [containerRef]),
    useCallback((width, height) => setContainerSize({ width, height }), [])
  );

  return getCallTileGridLayout(tileCount, containerSize.width, containerSize.height);
};
