import React, { useCallback, useRef, useState } from 'react';
import { render, act } from '@testing-library/react';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  installIntersectionObserverStub,
  ioInstances,
  stubScrollGeometry,
} from '../features/room/timeline/timelineTestHelpers';
import type { ScrollGeometry } from '../features/room/timeline/timelineTestHelpers';
import { useVirtualPaginator } from './useVirtualPaginator';
import type { ItemRange } from './useVirtualPaginator';

const ROW_HEIGHT_PX = 50;
const LIMIT = 80;
const INITIAL_COUNT = 500;
const INITIAL_RANGE: ItemRange = { start: 200, end: 280 };
const INITIAL_SCROLL_TOP = 100;
const VIEWPORT_HEIGHT_PX = 400;

const RESTORED_SCROLL_TOP = INITIAL_SCROLL_TOP + LIMIT * ROW_HEIGHT_PX;

type HarnessHandle = {
  appendItems: (additionalCount: number) => void;
  renumberItems: (shift: number) => void;
};

type RowProps = {
  index: number;
  rangeStart: number;
};

function Row({ index, rangeStart }: RowProps) {
  const offsetTop = (index - rangeStart) * ROW_HEIGHT_PX;
  return (
    <div
      data-message-item={index}
      ref={(rowElement) => {
        if (!rowElement) return;
        Object.defineProperty(rowElement, 'offsetTop', {
          configurable: true,
          get: () => offsetTop,
        });
        Object.defineProperty(rowElement, 'clientHeight', {
          configurable: true,
          get: () => ROW_HEIGHT_PX,
        });
      }}
    />
  );
}

type HarnessProps = {
  onHandle: (handle: HarnessHandle) => void;
};

function Harness({ onHandle }: HarnessProps) {
  const [range, setRange] = useState<ItemRange>(INITIAL_RANGE);
  const [count, setCount] = useState(INITIAL_COUNT);
  const [indexShift, setIndexShift] = useState(0);
  const scrollRef = useRef<HTMLDivElement>(null);

  const getScrollElement = useCallback(() => scrollRef.current, []);
  const getItemElement = useCallback(
    (index: number) =>
      (scrollRef.current?.querySelector(`[data-message-item="${index}"]`) as HTMLElement) ??
      undefined,
    []
  );

  const { getItems, observeBackAnchor } = useVirtualPaginator({
    count,
    limit: LIMIT,
    range,
    onRangeChange: setRange,
    getScrollElement,
    getItemElement,
  });

  onHandle({
    appendItems: (additionalCount) => setCount((current) => current + additionalCount),
    renumberItems: (shift) => {
      setIndexShift((current) => current + shift);
      setCount((current) => current + shift);
      setRange((current) => ({ start: current.start + shift, end: current.end + shift }));
    },
  });

  return (
    <div ref={scrollRef} data-testid="scroll">
      <div ref={observeBackAnchor} data-testid="back-anchor" />
      {getItems().map((index) => (
        <Row key={index - indexShift} index={index} rangeStart={range.start} />
      ))}
    </div>
  );
}

const renderPaginator = () => {
  const handleRef: { current: HarnessHandle | null } = { current: null };
  const { container } = render(
    <Harness
      onHandle={(handle) => {
        handleRef.current = handle;
      }}
    />
  );
  const scrollElement = container.querySelector('[data-testid="scroll"]') as HTMLDivElement;
  const geometry = stubScrollGeometry(scrollElement, {
    scrollHeight: LIMIT * ROW_HEIGHT_PX,
    offsetHeight: VIEWPORT_HEIGHT_PX,
  });
  geometry.setScrollTop(INITIAL_SCROLL_TOP);
  return { handle: () => handleRef.current!, geometry };
};

const paginateBackward = (geometry: ScrollGeometry, alsoInSameBatch?: () => void) => {
  act(() => {
    ioInstances[0].trigger(true);
    alsoInSameBatch?.();
  });
  return geometry.getScrollTop();
};

let originalIntersectionObserver: typeof IntersectionObserver | undefined;

beforeEach(() => {
  originalIntersectionObserver = (
    globalThis as unknown as { IntersectionObserver: typeof IntersectionObserver }
  ).IntersectionObserver;
  installIntersectionObserverStub();
});

afterEach(() => {
  if (originalIntersectionObserver) {
    (
      globalThis as unknown as { IntersectionObserver: typeof IntersectionObserver }
    ).IntersectionObserver = originalIntersectionObserver;
  }
  ioInstances.length = 0;
});

describe('useVirtualPaginator', () => {
  it('restores scroll position after back pagination', () => {
    const { geometry } = renderPaginator();

    expect(paginateBackward(geometry)).toBe(RESTORED_SCROLL_TOP);
  });

  it('restores scroll position when items are appended in the same batch as the pagination', () => {
    const { handle, geometry } = renderPaginator();

    expect(paginateBackward(geometry, () => handle().appendItems(3))).toBe(RESTORED_SCROLL_TOP);
  });

  it('restores scroll position when items are renumbered in the same batch as the pagination', () => {
    const { handle, geometry } = renderPaginator();

    expect(paginateBackward(geometry, () => handle().renumberItems(40))).toBe(RESTORED_SCROLL_TOP);
  });
});
