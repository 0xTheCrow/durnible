import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import { render } from '@testing-library/react';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { useVirtualPaginator } from '../../../hooks/useVirtualPaginator';
import {
  computeAnchorScrollTop,
  isIntersectingScrollView,
  scrollToBottom,
} from '../../../utils/dom';
import {
  createEventEmitterRoom,
  installIntersectionObserverStub,
  ioInstances,
  stubScrollGeometry,
} from './timelineTestHelpers';
import {
  getMarkerAnchorId,
  NEW_MESSAGES_DIVIDER_TOP_OFFSET_FRACTION,
  useTimelineAutoScroll,
} from './useTimelineAutoScroll';

const VIEWPORT_HEIGHT = 800;
const PAGINATOR_LIMIT = 25;

type Scenario = {
  messageHeights: number[];
  dividerInsertedAfterIndex: number;
};

const lotsOfUnread: Scenario = {
  messageHeights: Array.from({ length: 50 }, () => 40),
  dividerInsertedAfterIndex: 4,
};

const oneLongUnread: Scenario = {
  messageHeights: [30, 30, 30, 30, 30, 3000],
  dividerInsertedAfterIndex: 4,
};

function computeOffsets(scenario: Scenario) {
  const cumulativeOffsets: number[] = [];
  let cursor = 0;
  scenario.messageHeights.forEach((height) => {
    cumulativeOffsets.push(cursor);
    cursor += height;
  });
  const dividerOffsetTop =
    cumulativeOffsets[scenario.dividerInsertedAfterIndex] +
    scenario.messageHeights[scenario.dividerInsertedAfterIndex];
  const totalContentHeight = cursor;
  return { cumulativeOffsets, dividerOffsetTop, totalContentHeight };
}

function stubItemGeometry(
  element: HTMLElement,
  offsetTop: number,
  height: number,
  getScrollTop: () => number
) {
  Object.defineProperty(element, 'offsetTop', { configurable: true, get: () => offsetTop });
  Object.defineProperty(element, 'clientHeight', { configurable: true, get: () => height });
  Object.defineProperty(element, 'offsetHeight', { configurable: true, get: () => height });
  Object.defineProperty(element, 'getBoundingClientRect', {
    configurable: true,
    value: () => {
      const top = offsetTop - getScrollTop();
      return {
        top,
        bottom: top + height,
        left: 0,
        right: 0,
        width: 0,
        height,
        x: 0,
        y: top,
        toJSON: () => ({}),
      };
    },
  });
}

function stubScrollContainerRect(element: HTMLElement, height: number) {
  Object.defineProperty(element, 'getBoundingClientRect', {
    configurable: true,
    value: () => ({
      top: 0,
      bottom: height,
      left: 0,
      right: 0,
      width: 0,
      height,
      x: 0,
      y: 0,
      toJSON: () => ({}),
    }),
  });
  Object.defineProperty(element, 'offsetTop', { configurable: true, get: () => 0 });
}

type HarnessProps = {
  scenario: Scenario;
  onRangeChange: (range: { start: number; end: number }) => void;
  willScrollToReadMarker: boolean;
};

const DIVIDER_HEIGHT = 1;

function Harness({ scenario, onRangeChange, willScrollToReadMarker }: HarnessProps) {
  const room = useMemo(() => createEventEmitterRoom('!test:example.com'), []);

  const { scrollRef, setAnchor, requestScrollToBottom } = useTimelineAutoScroll({
    room,
    viewingLatest: true,
    initiallyAtBottom: false,
  });

  const itemRefs = useRef<Map<number, HTMLElement>>(new Map());
  const dividerRef = useRef<HTMLDivElement | null>(null);
  const frontAnchorRef = useRef<HTMLDivElement | null>(null);

  const { cumulativeOffsets, dividerOffsetTop, totalContentHeight } = useMemo(
    () => computeOffsets(scenario),
    [scenario]
  );

  const messageCount = scenario.messageHeights.length;

  const getScrollElement = useCallback(() => scrollRef.current, [scrollRef]);
  const getItemElement = useCallback((index: number) => itemRefs.current.get(index), []);
  const range = useMemo(() => ({ start: 0, end: messageCount }), [messageCount]);

  const { getItems, observeFrontAnchor } = useVirtualPaginator({
    count: messageCount * 4,
    limit: PAGINATOR_LIMIT,
    range,
    onRangeChange,
    getScrollElement,
    getItemElement,
  });

  // Geometry stub runs first so the scrollToBottom and anchor effects below
  // see real numbers — declaration order determines layout-effect order.
  useLayoutEffect(() => {
    const scrollElement = scrollRef.current;
    if (!scrollElement) return;

    const geometry = stubScrollGeometry(scrollElement, {
      scrollHeight: totalContentHeight,
      offsetHeight: VIEWPORT_HEIGHT,
    });
    stubScrollContainerRect(scrollElement, VIEWPORT_HEIGHT);

    itemRefs.current.forEach((element, index) => {
      stubItemGeometry(
        element,
        cumulativeOffsets[index],
        scenario.messageHeights[index],
        geometry.getScrollTop
      );
    });
    if (dividerRef.current) {
      stubItemGeometry(dividerRef.current, dividerOffsetTop, DIVIDER_HEIGHT, geometry.getScrollTop);
    }
    if (frontAnchorRef.current) {
      stubItemGeometry(frontAnchorRef.current, totalContentHeight, 0, geometry.getScrollTop);
    }
  }, [scrollRef, scenario, cumulativeOffsets, dividerOffsetTop, totalContentHeight]);

  // Mirrors RoomTimeline's mount-time scrollToBottom layout effect.
  useLayoutEffect(() => {
    const scrollElement = scrollRef.current;
    if (!scrollElement) return;
    scrollToBottom(scrollElement);
  }, [scrollRef]);

  // Mirrors RoomTimeline's new-messages anchor layout effect.
  useLayoutEffect(() => {
    setAnchor({
      kind: 'marker',
      markerId: 'unread',
      align: 'start',
      offset: Math.round(VIEWPORT_HEIGHT * NEW_MESSAGES_DIVIDER_TOP_OFFSET_FRACTION),
    });
  }, [setAnchor]);

  // Mirrors RoomTimeline's post-paint useEffect that conditionally calls
  // requestScrollToBottom(false). Production gates this on
  // !willScrollToReadMarker to avoid overriding the anchor placed above.
  const willScrollToReadMarkerRef = useRef(willScrollToReadMarker);
  willScrollToReadMarkerRef.current = willScrollToReadMarker;
  useEffect(() => {
    if (!willScrollToReadMarkerRef.current) {
      requestScrollToBottom(false);
    }
  }, [requestScrollToBottom]);

  return (
    <div ref={scrollRef} data-testid="timeline-scroll">
      {getItems().map((index) => (
        <React.Fragment key={index}>
          <div
            ref={(element) => {
              if (element) itemRefs.current.set(index, element);
              else itemRefs.current.delete(index);
            }}
            data-message-id={`msg-${index}`}
          />
          {index === scenario.dividerInsertedAfterIndex && (
            <div
              ref={dividerRef}
              data-testid="new-messages-divider"
              data-anchor-id={getMarkerAnchorId('unread')}
            />
          )}
        </React.Fragment>
      ))}
      <div
        ref={(element) => {
          frontAnchorRef.current = element;
          observeFrontAnchor(element);
        }}
        data-testid="front-anchor"
      />
    </div>
  );
}

let originalIntersectionObserver: typeof IntersectionObserver | undefined;

describe('RoomTimeline new-messages divider anchor on initial load', () => {
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

  it('keeps the divider at the configured viewport-fraction offset after the post-paint requestScrollToBottom fires (lots-of-unread geometry)', () => {
    const onRangeChange = vi.fn();

    const { container } = render(
      <Harness scenario={lotsOfUnread} onRangeChange={onRangeChange} willScrollToReadMarker />
    );

    const scrollEl = container.querySelector<HTMLDivElement>('[data-testid="timeline-scroll"]');
    const divider = container.querySelector<HTMLDivElement>('[data-testid="new-messages-divider"]');
    const frontAnchor = container.querySelector<HTMLDivElement>('[data-testid="front-anchor"]');
    expect(scrollEl).not.toBeNull();
    expect(divider).not.toBeNull();
    expect(frontAnchor).not.toBeNull();

    const expectedOffset = Math.round(VIEWPORT_HEIGHT * NEW_MESSAGES_DIVIDER_TOP_OFFSET_FRACTION);
    const expectedScrollTop = computeAnchorScrollTop(scrollEl!, divider!, 'start', expectedOffset);
    expect(scrollEl!.scrollTop).toBe(expectedScrollTop);

    const dividerTopRelativeToViewport =
      divider!.getBoundingClientRect().top - scrollEl!.getBoundingClientRect().top;
    expect(dividerTopRelativeToViewport).toBeCloseTo(expectedOffset, 0);

    expect(isIntersectingScrollView(scrollEl!, frontAnchor!)).toBe(false);
  });

  it('keeps the divider at the configured viewport-fraction offset for a single very-tall unread message', () => {
    const onRangeChange = vi.fn();

    const { container } = render(
      <Harness scenario={oneLongUnread} onRangeChange={onRangeChange} willScrollToReadMarker />
    );

    const scrollEl = container.querySelector<HTMLDivElement>('[data-testid="timeline-scroll"]');
    const divider = container.querySelector<HTMLDivElement>('[data-testid="new-messages-divider"]');
    expect(scrollEl).not.toBeNull();
    expect(divider).not.toBeNull();

    const expectedOffset = Math.round(VIEWPORT_HEIGHT * NEW_MESSAGES_DIVIDER_TOP_OFFSET_FRACTION);
    const expectedScrollTop = computeAnchorScrollTop(scrollEl!, divider!, 'start', expectedOffset);
    expect(scrollEl!.scrollTop).toBe(expectedScrollTop);

    const dividerTopRelativeToViewport =
      divider!.getBoundingClientRect().top - scrollEl!.getBoundingClientRect().top;
    expect(dividerTopRelativeToViewport).toBeCloseTo(expectedOffset, 0);
  });
});
