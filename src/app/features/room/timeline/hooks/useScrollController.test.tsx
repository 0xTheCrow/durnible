import React, { useRef } from 'react';
import { render, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  installResizeObserverStub,
  resizeObserverInstances,
  stubScrollGeometry,
} from '../timelineTestHelpers';
import { useScrollController, LIVE_EDGE_THRESHOLD_PX } from './useScrollController';
import type { ScrollController } from './useScrollController';

type HarnessProps = {
  isInLivePaginationWindowRef: React.RefObject<boolean>;
  unfocusedAutoScrollRef: React.RefObject<boolean>;
  onHook: (controller: ScrollController) => void;
};

function Harness({ isInLivePaginationWindowRef, unfocusedAutoScrollRef, onHook }: HarnessProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const controller = useScrollController({
    scrollRef,
    contentRef,
    isInLivePaginationWindowRef,
    unfocusedAutoScrollRef,
  });
  onHook(controller);
  return (
    <div ref={scrollRef} data-testid="scroll">
      <div ref={contentRef} data-testid="content" />
    </div>
  );
}

const ref = (value: boolean): React.RefObject<boolean> => ({ current: value });

const renderController = (
  isInLivePaginationWindowRef: React.RefObject<boolean>,
  unfocusedAutoScrollRef: React.RefObject<boolean> = ref(false)
) => {
  const hookRef: { current: ScrollController | null } = { current: null };
  const { container } = render(
    <Harness
      isInLivePaginationWindowRef={isInLivePaginationWindowRef}
      unfocusedAutoScrollRef={unfocusedAutoScrollRef}
      onHook={(controller) => {
        hookRef.current = controller;
      }}
    />
  );
  const scrollElement = container.querySelector('[data-testid="scroll"]') as HTMLDivElement;
  return { controller: () => hookRef.current!, scrollElement };
};

type StubbedRow = {
  setOffsetTop: (value: number) => void;
};

const appendRow = (
  contentElement: HTMLElement,
  offsetTop: number,
  offsetHeight: number
): StubbedRow => {
  const rowElement = document.createElement('div');
  rowElement.setAttribute('data-message-id', '$row');
  let currentOffsetTop = offsetTop;
  Object.defineProperty(rowElement, 'offsetTop', {
    configurable: true,
    get: () => currentOffsetTop,
  });
  Object.defineProperty(rowElement, 'offsetHeight', {
    configurable: true,
    get: () => offsetHeight,
  });
  contentElement.appendChild(rowElement);
  return {
    setOffsetTop: (value) => {
      currentOffsetTop = value;
    },
  };
};

let originalResizeObserver: typeof ResizeObserver | undefined;

beforeEach(() => {
  originalResizeObserver = (globalThis as unknown as { ResizeObserver: typeof ResizeObserver })
    .ResizeObserver;
  installResizeObserverStub();
});

afterEach(() => {
  if (originalResizeObserver) {
    (globalThis as unknown as { ResizeObserver: typeof ResizeObserver }).ResizeObserver =
      originalResizeObserver;
  }
  resizeObserverInstances.length = 0;
  vi.restoreAllMocks();
});

describe('useScrollController', () => {
  describe('syncFollowLive', () => {
    it('does not enter followLive at the bottom when not in the live pagination window', () => {
      const { controller } = renderController(ref(false));
      act(() => controller().syncFollowLive(true));
      expect(controller().intentRef.current?.kind).toBe('free');
    });

    it('enters followLive at the bottom when in the live pagination window', () => {
      const { controller } = renderController(ref(true));
      act(() => controller().syncFollowLive(true));
      expect(controller().intentRef.current?.kind).toBe('followLive');
    });

    it('demotes followLive when drift exceeds the release threshold after user scroll input', () => {
      const isInLivePaginationWindowRef = ref(true);
      const { controller, scrollElement } = renderController(isInLivePaginationWindowRef);
      const geometry = stubScrollGeometry(scrollElement, { scrollHeight: 500, offsetHeight: 400 });
      geometry.setScrollTop(100);
      act(() => controller().syncFollowLive(true));
      expect(controller().intentRef.current?.kind).toBe('followLive');

      act(() => {
        scrollElement.dispatchEvent(new Event('wheel'));
      });
      geometry.setScrollTop(100 - (LIVE_EDGE_THRESHOLD_PX + 10));
      act(() => controller().syncFollowLive(false));
      expect(controller().intentRef.current?.kind).toBe('free');
    });

    it('keeps followLive after user scroll input when drift stays within the release threshold', () => {
      const isInLivePaginationWindowRef = ref(true);
      const { controller, scrollElement } = renderController(isInLivePaginationWindowRef);
      const geometry = stubScrollGeometry(scrollElement, { scrollHeight: 500, offsetHeight: 400 });
      geometry.setScrollTop(100);
      act(() => controller().syncFollowLive(true));
      expect(controller().intentRef.current?.kind).toBe('followLive');

      act(() => {
        scrollElement.dispatchEvent(new Event('wheel'));
      });
      geometry.setScrollTop(100 - (LIVE_EDGE_THRESHOLD_PX - 10));
      act(() => controller().syncFollowLive(false));
      expect(controller().intentRef.current?.kind).toBe('followLive');
    });

    it('keeps followLive on drift without user scroll input', () => {
      const isInLivePaginationWindowRef = ref(true);
      const { controller, scrollElement } = renderController(isInLivePaginationWindowRef);
      const geometry = stubScrollGeometry(scrollElement, { scrollHeight: 500, offsetHeight: 400 });
      act(() => controller().syncFollowLive(true));
      expect(controller().intentRef.current?.kind).toBe('followLive');

      geometry.setScrollTop(100 - (LIVE_EDGE_THRESHOLD_PX + 200));
      act(() => controller().syncFollowLive(false));
      expect(controller().intentRef.current?.kind).toBe('followLive');
    });

    it('stops gluing to the live edge on user input when the drift was never released', () => {
      vi.spyOn(document, 'hasFocus').mockReturnValue(true);
      const { controller, scrollElement } = renderController(ref(true));
      const geometry = stubScrollGeometry(scrollElement, { scrollHeight: 2000, offsetHeight: 400 });
      const bottomScrollTop = 2000 - 400;
      const historyScrollTop = bottomScrollTop - (LIVE_EDGE_THRESHOLD_PX + 200);

      geometry.setScrollTop(bottomScrollTop);
      act(() => controller().syncFollowLive(true));

      geometry.setScrollTop(historyScrollTop);
      act(() => controller().syncFollowLive(false));

      act(() => {
        scrollElement.dispatchEvent(new Event('wheel'));
      });

      geometry.setScrollHeight(2100);
      act(() => resizeObserverInstances[0].trigger());

      expect(geometry.getScrollTop()).toBe(historyScrollTop);
    });

    it('releases the live edge on a displaced scroll without a bound input event', () => {
      const { controller, scrollElement } = renderController(ref(true));
      const geometry = stubScrollGeometry(scrollElement, {
        scrollHeight: 2000,
        offsetHeight: 400,
      });
      const bottomScrollTop = 2000 - 400;

      geometry.setScrollTop(bottomScrollTop);
      act(() => controller().syncFollowLive(true));
      expect(controller().intentRef.current?.kind).toBe('followLive');

      geometry.setScrollTop(bottomScrollTop - (LIVE_EDGE_THRESHOLD_PX + 100));
      act(() => {
        scrollElement.dispatchEvent(new Event('scroll'));
      });

      expect(controller().intentRef.current?.kind).toBe('free');
    });
  });

  describe('maintainPosition on resize', () => {
    it('does not re-pin followLive while unfocused with unfocusedAutoScroll off', () => {
      vi.spyOn(document, 'hasFocus').mockReturnValue(false);
      const { controller, scrollElement } = renderController(ref(true), ref(false));
      const geometry = stubScrollGeometry(scrollElement, { scrollHeight: 500, offsetHeight: 400 });

      act(() => controller().pinToLiveEnd());
      expect(geometry.getScrollTop()).toBe(100);

      geometry.setScrollHeight(600);
      act(() => resizeObserverInstances[0].trigger());

      expect(geometry.getScrollTop()).toBe(100);
    });

    it('keeps the same content under the viewport when content above it grows while free', () => {
      vi.spyOn(document, 'hasFocus').mockReturnValue(true);
      const { controller, scrollElement } = renderController(ref(false), ref(false));
      const contentElement = scrollElement.querySelector('[data-testid="content"]') as HTMLElement;
      const geometry = stubScrollGeometry(scrollElement, { scrollHeight: 5000, offsetHeight: 400 });
      const viewportTopScrollTop = 2000;
      const growthAboveViewportPx = 300;

      const topRow = appendRow(contentElement, viewportTopScrollTop, 500);
      geometry.setScrollTop(viewportTopScrollTop);
      act(() => {
        scrollElement.dispatchEvent(new Event('scroll'));
      });
      expect(controller().intentRef.current?.kind).toBe('free');

      topRow.setOffsetTop(viewportTopScrollTop + growthAboveViewportPx);
      geometry.setScrollHeight(5000 + growthAboveViewportPx);
      act(() => resizeObserverInstances[0].trigger());

      expect(geometry.getScrollTop()).toBe(viewportTopScrollTop + growthAboveViewportPx);
    });

    it('re-pins followLive on resize when focused', () => {
      vi.spyOn(document, 'hasFocus').mockReturnValue(true);
      const { controller, scrollElement } = renderController(ref(true), ref(false));
      const geometry = stubScrollGeometry(scrollElement, { scrollHeight: 500, offsetHeight: 400 });

      act(() => controller().pinToLiveEnd());
      expect(geometry.getScrollTop()).toBe(100);

      geometry.setScrollHeight(600);
      act(() => resizeObserverInstances[0].trigger());

      expect(geometry.getScrollTop()).toBe(200);
    });
  });
});
