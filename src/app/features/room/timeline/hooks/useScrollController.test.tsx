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
  wasLatestMessageBottomInViewRef: React.MutableRefObject<boolean>;
  reportLatestMessageBottomInView: () => void;
  unfocusedAutoScrollRef: React.RefObject<boolean>;
  onHook: (controller: ScrollController) => void;
};

function Harness({
  isInLivePaginationWindowRef,
  wasLatestMessageBottomInViewRef,
  reportLatestMessageBottomInView,
  unfocusedAutoScrollRef,
  onHook,
}: HarnessProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const latestMessageBottomRef = useRef<HTMLSpanElement>(null);
  const controller = useScrollController({
    scrollRef,
    contentRef,
    isInLivePaginationWindowRef,
    wasLatestMessageBottomInViewRef,
    reportLatestMessageBottomInView,
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
  unfocusedAutoScrollRef: React.RefObject<boolean> = ref(false),
  isLatestMessageBottomInitiallyInView = true
) => {
  const wasLatestMessageBottomInViewRef = ref(isLatestMessageBottomInitiallyInView);
  const hookRef: { current: ScrollController | null } = { current: null };
  const { container } = render(
    <Harness
      isInLivePaginationWindowRef={isInLivePaginationWindowRef}
      wasLatestMessageBottomInViewRef={wasLatestMessageBottomInViewRef}
      reportLatestMessageBottomInView={() => {
        wasLatestMessageBottomInViewRef.current = true;
      }}
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
  return {
    controller: () => hookRef.current!,
    scrollElement,
    anchorElement,
    wasLatestMessageBottomInViewRef,
  };
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
    it('is true when the last observer report placed the newest message in view inside the live window', () => {
      const { controller } = renderController(ref(true));

      expect(controller().checkIsLatestMessageBottomVisible()).toBe(true);
    });

    it('is false at the bottom of a window that is not the live window', () => {
      const { controller } = renderController(ref(false));

      expect(controller().checkIsLatestMessageBottomVisible()).toBe(false);
    });

    it('is false in the live window when the last observer report placed the newest message out of view', () => {
      const { controller } = renderController(ref(true), ref(false), false);

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
    it('scrolls to the newest message when content grows while pinned to it', () => {
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

    it('holds the newest message through growth the observers have not reported yet', () => {
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

    it('does not scroll to the newest message when it is out of view', () => {
      vi.spyOn(document, 'hasFocus').mockReturnValue(true);
      const { scrollElement, anchorElement } = renderController(ref(true), ref(false), false);
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

    it('does not scroll to the newest message at the bottom of a window that is not the live window', () => {
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

    it('does not re-pin the newest message while unfocused with unfocusedAutoScroll off', () => {
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

  describe('following across observer reports', () => {
    it('follows the newest message again once the observer reports it back in view', () => {
      vi.spyOn(document, 'hasFocus').mockReturnValue(true);
      const { scrollElement, anchorElement, wasLatestMessageBottomInViewRef } = renderController(
        ref(true),
        ref(false),
        false
      );
      const geometry = stubScrollGeometry(scrollElement, {
        scrollHeight: 2000,
        offsetHeight: 400,
        anchorElement,
      });
      const historyScrollTop = 400;

      geometry.setScrollTop(historyScrollTop);
      geometry.setScrollHeight(2100);
      act(() => resizeObserverInstances[0].trigger());
      expect(geometry.getScrollTop()).toBe(historyScrollTop);

      wasLatestMessageBottomInViewRef.current = true;
      geometry.setScrollHeight(2200);
      act(() => resizeObserverInstances[0].trigger());

      expect(geometry.getScrollTop()).toBe(1800);
    });
  });
});
