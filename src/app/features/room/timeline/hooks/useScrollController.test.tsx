import React, { useRef } from 'react';
import { render, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  installResizeObserverStub,
  resizeObserverInstances,
  stubScrollGeometry,
} from '../timelineTestHelpers';
import {
  useScrollController,
  LATEST_MESSAGE_BOTTOM_RELEASE_THRESHOLD_PX,
} from './useScrollController';
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
  describe('syncLatestMessageBottomFollow', () => {
    it('does not enter latestMessageBottom at the bottom when not in the live pagination window', () => {
      const { controller } = renderController(ref(false));
      act(() => controller().syncLatestMessageBottomFollow(true));
      expect(controller().intentRef.current?.kind).toBe('free');
    });

    it('enters latestMessageBottom at the bottom when in the live pagination window', () => {
      const { controller } = renderController(ref(true));
      act(() => controller().syncLatestMessageBottomFollow(true));
      expect(controller().intentRef.current?.kind).toBe('latestMessageBottom');
    });

    it('demotes latestMessageBottom when drift exceeds the release threshold after user scroll input', () => {
      const isInLivePaginationWindowRef = ref(true);
      const { controller, scrollElement, anchorElement } = renderController(
        isInLivePaginationWindowRef
      );
      const geometry = stubScrollGeometry(scrollElement, {
        scrollHeight: 500,
        offsetHeight: 400,
        anchorElement,
      });
      geometry.setScrollTop(100);
      act(() => controller().syncLatestMessageBottomFollow(true));
      expect(controller().intentRef.current?.kind).toBe('latestMessageBottom');

      act(() => {
        scrollElement.dispatchEvent(new Event('wheel'));
      });
      geometry.setScrollTop(100 - (LATEST_MESSAGE_BOTTOM_RELEASE_THRESHOLD_PX + 10));
      act(() => controller().syncLatestMessageBottomFollow(false));
      expect(controller().intentRef.current?.kind).toBe('free');
    });

    it('keeps latestMessageBottom after user scroll input when drift stays within the release threshold', () => {
      const isInLivePaginationWindowRef = ref(true);
      const { controller, scrollElement, anchorElement } = renderController(
        isInLivePaginationWindowRef
      );
      const geometry = stubScrollGeometry(scrollElement, {
        scrollHeight: 500,
        offsetHeight: 400,
        anchorElement,
      });
      geometry.setScrollTop(100);
      act(() => controller().syncLatestMessageBottomFollow(true));
      expect(controller().intentRef.current?.kind).toBe('latestMessageBottom');

      act(() => {
        scrollElement.dispatchEvent(new Event('wheel'));
      });
      geometry.setScrollTop(100 - (LATEST_MESSAGE_BOTTOM_RELEASE_THRESHOLD_PX - 10));
      act(() => controller().syncLatestMessageBottomFollow(false));
      expect(controller().intentRef.current?.kind).toBe('latestMessageBottom');
    });

    it('keeps latestMessageBottom on drift without user scroll input', () => {
      const isInLivePaginationWindowRef = ref(true);
      const { controller, scrollElement, anchorElement } = renderController(
        isInLivePaginationWindowRef
      );
      const geometry = stubScrollGeometry(scrollElement, {
        scrollHeight: 500,
        offsetHeight: 400,
        anchorElement,
      });
      act(() => controller().syncLatestMessageBottomFollow(true));
      expect(controller().intentRef.current?.kind).toBe('latestMessageBottom');

      geometry.setScrollTop(100 - (LATEST_MESSAGE_BOTTOM_RELEASE_THRESHOLD_PX + 200));
      act(() => controller().syncLatestMessageBottomFollow(false));
      expect(controller().intentRef.current?.kind).toBe('latestMessageBottom');
    });

    it('stops gluing to the latest message bottom on user input when the drift was never released', () => {
      vi.spyOn(document, 'hasFocus').mockReturnValue(true);
      const { controller, scrollElement, anchorElement } = renderController(ref(true));
      const geometry = stubScrollGeometry(scrollElement, {
        scrollHeight: 2000,
        offsetHeight: 400,
        anchorElement,
      });
      const bottomScrollTop = 2000 - 400;
      const historyScrollTop = bottomScrollTop - (LATEST_MESSAGE_BOTTOM_RELEASE_THRESHOLD_PX + 200);

      geometry.setScrollTop(bottomScrollTop);
      act(() => controller().syncLatestMessageBottomFollow(true));

      geometry.setScrollTop(historyScrollTop);
      act(() => controller().syncLatestMessageBottomFollow(false));

      act(() => {
        scrollElement.dispatchEvent(new Event('wheel'));
      });

      geometry.setScrollHeight(2100);
      act(() => resizeObserverInstances[0].trigger());

      expect(geometry.getScrollTop()).toBe(historyScrollTop);
    });

    it('releases the latest message bottom follow on a displaced scroll without a bound input event', () => {
      const { controller, scrollElement, anchorElement } = renderController(ref(true));
      const geometry = stubScrollGeometry(scrollElement, {
        scrollHeight: 2000,
        offsetHeight: 400,
        anchorElement,
      });
      const bottomScrollTop = 2000 - 400;

      geometry.setScrollTop(bottomScrollTop);
      act(() => controller().syncLatestMessageBottomFollow(true));
      expect(controller().intentRef.current?.kind).toBe('latestMessageBottom');

      geometry.setScrollTop(bottomScrollTop - (LATEST_MESSAGE_BOTTOM_RELEASE_THRESHOLD_PX + 100));
      act(() => {
        scrollElement.dispatchEvent(new Event('scroll'));
      });

      expect(controller().intentRef.current?.kind).toBe('free');
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
    it('does not re-pin latestMessageBottom while unfocused with unfocusedAutoScroll off', () => {
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

    it('keeps the same content under the viewport when content above it grows while free', () => {
      vi.spyOn(document, 'hasFocus').mockReturnValue(true);
      const { controller, scrollElement, anchorElement } = renderController(ref(false), ref(false));
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
      expect(controller().intentRef.current?.kind).toBe('free');

      topRow.setOffsetTop(viewportTopScrollTop + growthAboveViewportPx);
      geometry.setScrollHeight(5000 + growthAboveViewportPx);
      act(() => resizeObserverInstances[0].trigger());

      expect(geometry.getScrollTop()).toBe(viewportTopScrollTop + growthAboveViewportPx);
    });

    it('re-pins latestMessageBottom on resize when focused', () => {
      vi.spyOn(document, 'hasFocus').mockReturnValue(true);
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

      expect(geometry.getScrollTop()).toBe(200);
    });
  });
});
