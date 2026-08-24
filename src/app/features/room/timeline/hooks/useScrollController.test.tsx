import React, { useRef } from 'react';
import { render, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  installResizeObserverStub,
  resizeObserverInstances,
  stubScrollGeometry,
} from '../timelineTestHelpers';
import { useScrollController } from './useScrollController';
import type { ScrollController } from './useScrollController';

type HarnessProps = {
  isInLivePaginationWindowRef: React.RefObject<boolean>;
  isNewestMessageVisibleRef: React.RefObject<boolean>;
  unfocusedAutoScrollRef: React.RefObject<boolean>;
  onHook: (controller: ScrollController) => void;
};

function Harness({
  isInLivePaginationWindowRef,
  isNewestMessageVisibleRef,
  unfocusedAutoScrollRef,
  onHook,
}: HarnessProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const controller = useScrollController({
    scrollRef,
    contentRef,
    isInLivePaginationWindowRef,
    isNewestMessageVisibleRef,
    unfocusedAutoScrollRef,
  });
  onHook(controller);
  return (
    <div ref={scrollRef} data-testid="scroll">
      <div ref={contentRef} data-testid="content" />
    </div>
  );
}

const ref = (value: boolean) => ({ current: value });

const renderController = (
  isInLivePaginationWindowRef: React.RefObject<boolean>,
  isNewestMessageVisibleRef: React.RefObject<boolean>,
  unfocusedAutoScrollRef: React.RefObject<boolean> = ref(false)
) => {
  const hookRef: { current: ScrollController | null } = { current: null };
  const { container } = render(
    <Harness
      isInLivePaginationWindowRef={isInLivePaginationWindowRef}
      isNewestMessageVisibleRef={isNewestMessageVisibleRef}
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
  describe('checkIsAtLiveEdge', () => {
    it('is true only when the newest message is visible inside the live window', () => {
      const { controller } = renderController(ref(true), ref(true));
      expect(controller().checkIsAtLiveEdge()).toBe(true);
    });

    it('is false at the bottom of a window that is not the live window', () => {
      const { controller } = renderController(ref(false), ref(true));
      expect(controller().checkIsAtLiveEdge()).toBe(false);
    });

    it('is false in the live window when the newest message is out of view', () => {
      const { controller } = renderController(ref(true), ref(false));
      expect(controller().checkIsAtLiveEdge()).toBe(false);
    });
  });

  describe('maintainPosition on resize', () => {
    it('scrolls to the live end when content grows at the live edge', () => {
      vi.spyOn(document, 'hasFocus').mockReturnValue(true);
      const { controller, scrollElement } = renderController(ref(true), ref(true));
      const geometry = stubScrollGeometry(scrollElement, { scrollHeight: 500, offsetHeight: 400 });

      act(() => controller().pinToLiveEnd());
      expect(geometry.getScrollTop()).toBe(100);

      geometry.setScrollHeight(600);
      act(() => resizeObserverInstances[0].trigger());

      expect(geometry.getScrollTop()).toBe(200);
    });

    it('does not scroll to the live end when the newest message is out of view', () => {
      vi.spyOn(document, 'hasFocus').mockReturnValue(true);
      const { scrollElement } = renderController(ref(true), ref(false));
      const geometry = stubScrollGeometry(scrollElement, { scrollHeight: 2000, offsetHeight: 400 });
      const historyScrollTop = 900;

      geometry.setScrollTop(historyScrollTop);
      geometry.setScrollHeight(2100);
      act(() => resizeObserverInstances[0].trigger());

      expect(geometry.getScrollTop()).toBe(historyScrollTop);
    });

    it('does not scroll to the live end at the bottom of a window that is not the live window', () => {
      vi.spyOn(document, 'hasFocus').mockReturnValue(true);
      const { scrollElement } = renderController(ref(false), ref(true));
      const geometry = stubScrollGeometry(scrollElement, { scrollHeight: 2000, offsetHeight: 400 });
      const historyScrollTop = 1600;

      geometry.setScrollTop(historyScrollTop);
      geometry.setScrollHeight(2100);
      act(() => resizeObserverInstances[0].trigger());

      expect(geometry.getScrollTop()).toBe(historyScrollTop);
    });

    it('does not re-pin the live edge while unfocused with unfocusedAutoScroll off', () => {
      vi.spyOn(document, 'hasFocus').mockReturnValue(false);
      const { controller, scrollElement } = renderController(ref(true), ref(true), ref(false));
      const geometry = stubScrollGeometry(scrollElement, { scrollHeight: 500, offsetHeight: 400 });

      act(() => controller().pinToLiveEnd());
      expect(geometry.getScrollTop()).toBe(100);

      geometry.setScrollHeight(600);
      act(() => resizeObserverInstances[0].trigger());

      expect(geometry.getScrollTop()).toBe(100);
    });

    it('keeps the same content under the viewport when content above it grows', () => {
      vi.spyOn(document, 'hasFocus').mockReturnValue(true);
      const { scrollElement } = renderController(ref(false), ref(false));
      const contentElement = scrollElement.querySelector('[data-testid="content"]') as HTMLElement;
      const geometry = stubScrollGeometry(scrollElement, { scrollHeight: 5000, offsetHeight: 400 });
      const viewportTopScrollTop = 2000;
      const growthAboveViewportPx = 300;

      const topRow = appendRow(contentElement, viewportTopScrollTop, 500);
      geometry.setScrollTop(viewportTopScrollTop);
      act(() => {
        scrollElement.dispatchEvent(new Event('scroll'));
      });

      topRow.setOffsetTop(viewportTopScrollTop + growthAboveViewportPx);
      geometry.setScrollHeight(5000 + growthAboveViewportPx);
      act(() => resizeObserverInstances[0].trigger());

      expect(geometry.getScrollTop()).toBe(viewportTopScrollTop + growthAboveViewportPx);
    });
  });

  describe('displacement without a bound input event', () => {
    it('stops following the live edge once the newest message scrolls out of view', () => {
      vi.spyOn(document, 'hasFocus').mockReturnValue(true);
      const isNewestMessageVisibleRef = ref(true);
      const { controller, scrollElement } = renderController(ref(true), isNewestMessageVisibleRef);
      const geometry = stubScrollGeometry(scrollElement, { scrollHeight: 2000, offsetHeight: 400 });

      act(() => controller().pinToLiveEnd());
      expect(geometry.getScrollTop()).toBe(1600);

      const historyScrollTop = 400;
      geometry.setScrollTop(historyScrollTop);
      isNewestMessageVisibleRef.current = false;
      act(() => {
        scrollElement.dispatchEvent(new Event('scroll'));
      });

      geometry.setScrollHeight(2100);
      act(() => resizeObserverInstances[0].trigger());

      expect(geometry.getScrollTop()).toBe(historyScrollTop);
    });

    it('stops following the live edge when the displacement follows a live-end pin', () => {
      vi.spyOn(document, 'hasFocus').mockReturnValue(true);
      const isNewestMessageVisibleRef = ref(true);
      const { controller, scrollElement } = renderController(ref(true), isNewestMessageVisibleRef);
      const geometry = stubScrollGeometry(scrollElement, { scrollHeight: 2000, offsetHeight: 400 });

      act(() => controller().pinToLiveEnd());
      act(() => controller().pinToLiveEnd());

      const historyScrollTop = 400;
      geometry.setScrollTop(historyScrollTop);
      isNewestMessageVisibleRef.current = false;
      act(() => {
        scrollElement.dispatchEvent(new Event('scroll'));
      });

      geometry.setScrollHeight(2100);
      act(() => resizeObserverInstances[0].trigger());

      expect(geometry.getScrollTop()).toBe(historyScrollTop);
    });
  });
});
