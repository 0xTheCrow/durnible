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
  unfocusedAutoScrollRef: React.RefObject<boolean>;
  onHook: (controller: ScrollController) => void;
};

function Harness({ isInLivePaginationWindowRef, unfocusedAutoScrollRef, onHook }: HarnessProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const latestMessageBottomRef = useRef<HTMLSpanElement>(null);
  const controller = useScrollController({
    scrollRef,
    contentRef,
    isInLivePaginationWindowRef,
    latestMessageBottomRef,
    unfocusedAutoScrollRef,
  });
  onHook(controller);
  return (
    <div ref={scrollRef} data-testid="scroll">
      <div ref={contentRef} data-testid="content" />
      <span ref={latestMessageBottomRef} data-testid="latest-message-bottom" />
    </div>
  );
}

const ref = (value: boolean) => ({ current: value });

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
  const anchorElement = container.querySelector(
    '[data-testid="latest-message-bottom"]'
  ) as HTMLSpanElement;
  return { controller: () => hookRef.current!, scrollElement, anchorElement };
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
  describe('checkIsLatestMessageBottomVisible', () => {
    it('is true when the newest message is in view inside the live window', () => {
      const { controller, scrollElement, anchorElement } = renderController(ref(true));
      const geometry = stubScrollGeometry(scrollElement, {
        scrollHeight: 2000,
        offsetHeight: 400,
        anchorElement,
      });

      geometry.setScrollTop(1600);

      expect(controller().checkIsLatestMessageBottomVisible()).toBe(true);
    });

    it('is false at the bottom of a window that is not the live window', () => {
      const { controller, scrollElement, anchorElement } = renderController(ref(false));
      const geometry = stubScrollGeometry(scrollElement, {
        scrollHeight: 2000,
        offsetHeight: 400,
        anchorElement,
      });

      geometry.setScrollTop(1600);

      expect(controller().checkIsLatestMessageBottomVisible()).toBe(false);
    });

    it('is false in the live window when the newest message is out of view', () => {
      const { controller, scrollElement, anchorElement } = renderController(ref(true));
      const geometry = stubScrollGeometry(scrollElement, {
        scrollHeight: 2000,
        offsetHeight: 400,
        anchorElement,
      });

      geometry.setScrollTop(400);

      expect(controller().checkIsLatestMessageBottomVisible()).toBe(false);
    });
  });

  describe('pinToLatestMessageBottom target', () => {
    it('rests the newest message on the bottom of the viewport', () => {
      const { controller, scrollElement, anchorElement } = renderController(ref(true));
      const geometry = stubScrollGeometry(scrollElement, {
        scrollHeight: 2000,
        offsetHeight: 400,
        anchorElement,
      });

      act(() => controller().pinToLatestMessageBottom());

      expect(geometry.getScrollTop()).toBe(1600);
    });

    it('stops short of content rendered below the newest message', () => {
      const { controller, scrollElement, anchorElement } = renderController(ref(true));
      const skeletonsHeight = 300;
      const geometry = stubScrollGeometry(scrollElement, {
        scrollHeight: 2000,
        offsetHeight: 400,
        anchorElement,
        latestMessageBottom: 2000 - skeletonsHeight,
      });

      act(() => controller().pinToLatestMessageBottom());

      expect(geometry.getScrollTop()).toBe(1600 - skeletonsHeight);
    });
  });

  describe('maintainPosition on resize', () => {
    it('scrolls to the live end when content grows at the live edge', () => {
      vi.spyOn(document, 'hasFocus').mockReturnValue(true);
      const { controller, scrollElement, anchorElement } = renderController(ref(true));
      const geometry = stubScrollGeometry(scrollElement, {
        scrollHeight: 500,
        offsetHeight: 400,
        anchorElement,
      });

      act(() => controller().pinToLatestMessageBottom());
      expect(geometry.getScrollTop()).toBe(100);

      geometry.setScrollHeight(600);
      act(() => resizeObserverInstances[0].trigger());

      expect(geometry.getScrollTop()).toBe(200);
    });

    it('holds the live end through growth the observers have not reported yet', () => {
      vi.spyOn(document, 'hasFocus').mockReturnValue(true);
      const { controller, scrollElement, anchorElement } = renderController(ref(true));
      const geometry = stubScrollGeometry(scrollElement, {
        scrollHeight: 2000,
        offsetHeight: 400,
        anchorElement,
      });

      act(() => controller().pinToLatestMessageBottom());
      act(() => {
        scrollElement.dispatchEvent(new Event('scroll'));
      });

      geometry.setScrollHeight(2640);
      act(() => resizeObserverInstances[0].trigger());

      expect(geometry.getScrollTop()).toBe(2240);
    });

    it('does not scroll to the live end when the newest message is out of view', () => {
      vi.spyOn(document, 'hasFocus').mockReturnValue(true);
      const { scrollElement, anchorElement } = renderController(ref(true));
      const geometry = stubScrollGeometry(scrollElement, {
        scrollHeight: 2000,
        offsetHeight: 400,
        anchorElement,
      });
      const historyScrollTop = 900;

      geometry.setScrollTop(historyScrollTop);
      geometry.setScrollHeight(2100);
      act(() => resizeObserverInstances[0].trigger());

      expect(geometry.getScrollTop()).toBe(historyScrollTop);
    });

    it('does not scroll to the live end at the bottom of a window that is not the live window', () => {
      vi.spyOn(document, 'hasFocus').mockReturnValue(true);
      const { scrollElement, anchorElement } = renderController(ref(false));
      const geometry = stubScrollGeometry(scrollElement, {
        scrollHeight: 2000,
        offsetHeight: 400,
        anchorElement,
      });
      const historyScrollTop = 1600;

      geometry.setScrollTop(historyScrollTop);
      geometry.setScrollHeight(2100);
      act(() => resizeObserverInstances[0].trigger());

      expect(geometry.getScrollTop()).toBe(historyScrollTop);
    });

    it('does not re-pin the live edge while unfocused with unfocusedAutoScroll off', () => {
      vi.spyOn(document, 'hasFocus').mockReturnValue(false);
      const { controller, scrollElement, anchorElement } = renderController(ref(true), ref(false));
      const geometry = stubScrollGeometry(scrollElement, {
        scrollHeight: 500,
        offsetHeight: 400,
        anchorElement,
      });

      act(() => controller().pinToLatestMessageBottom());
      expect(geometry.getScrollTop()).toBe(100);

      geometry.setScrollHeight(600);
      act(() => resizeObserverInstances[0].trigger());

      expect(geometry.getScrollTop()).toBe(100);
    });

    it('keeps the same content under the viewport when content above it grows', () => {
      vi.spyOn(document, 'hasFocus').mockReturnValue(true);
      const { scrollElement, anchorElement } = renderController(ref(false));
      const contentElement = scrollElement.querySelector('[data-testid="content"]') as HTMLElement;
      const geometry = stubScrollGeometry(scrollElement, {
        scrollHeight: 5000,
        offsetHeight: 400,
        anchorElement,
      });
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
      const { controller, scrollElement, anchorElement } = renderController(ref(true));
      const geometry = stubScrollGeometry(scrollElement, {
        scrollHeight: 2000,
        offsetHeight: 400,
        anchorElement,
      });

      act(() => controller().pinToLatestMessageBottom());
      expect(geometry.getScrollTop()).toBe(1600);
      act(() => {
        scrollElement.dispatchEvent(new Event('scroll'));
      });

      const historyScrollTop = 400;
      geometry.setScrollTop(historyScrollTop);
      act(() => {
        scrollElement.dispatchEvent(new Event('scroll'));
      });

      geometry.setScrollHeight(2100);
      act(() => resizeObserverInstances[0].trigger());

      expect(geometry.getScrollTop()).toBe(historyScrollTop);
    });

    it('stops following the live edge when the displacement follows a live-end pin', () => {
      vi.spyOn(document, 'hasFocus').mockReturnValue(true);
      const { controller, scrollElement, anchorElement } = renderController(ref(true));
      const geometry = stubScrollGeometry(scrollElement, {
        scrollHeight: 2000,
        offsetHeight: 400,
        anchorElement,
      });

      act(() => controller().pinToLatestMessageBottom());
      act(() => controller().pinToLatestMessageBottom());
      act(() => {
        scrollElement.dispatchEvent(new Event('scroll'));
      });

      const historyScrollTop = 400;
      geometry.setScrollTop(historyScrollTop);
      act(() => {
        scrollElement.dispatchEvent(new Event('scroll'));
      });

      geometry.setScrollHeight(2100);
      act(() => resizeObserverInstances[0].trigger());

      expect(geometry.getScrollTop()).toBe(historyScrollTop);
    });

    it('keeps following the live edge when a shrink clamps the scroll offset down', () => {
      vi.spyOn(document, 'hasFocus').mockReturnValue(true);
      const { controller, scrollElement, anchorElement } = renderController(ref(true));
      const geometry = stubScrollGeometry(scrollElement, {
        scrollHeight: 2000,
        offsetHeight: 400,
        anchorElement,
      });

      act(() => controller().pinToLatestMessageBottom());
      act(() => {
        scrollElement.dispatchEvent(new Event('scroll'));
      });

      geometry.setScrollHeight(1500);
      geometry.setScrollTop(1100);
      act(() => {
        scrollElement.dispatchEvent(new Event('scroll'));
      });

      geometry.setScrollHeight(1600);
      act(() => resizeObserverInstances[0].trigger());

      expect(geometry.getScrollTop()).toBe(1200);
    });
  });
});
