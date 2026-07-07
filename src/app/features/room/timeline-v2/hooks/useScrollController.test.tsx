import React, { useRef } from 'react';
import { render, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  installResizeObserverStub,
  resizeObserverInstances,
  stubScrollGeometry,
} from '../../timeline/timelineTestHelpers';
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

    it('demotes followLive to free when scrolled away beyond the release threshold while focused', () => {
      vi.spyOn(document, 'hasFocus').mockReturnValue(true);
      const isInLivePaginationWindowRef = ref(true);
      const { controller, scrollElement } = renderController(isInLivePaginationWindowRef);
      const geometry = stubScrollGeometry(scrollElement, { scrollHeight: 500, offsetHeight: 400 });
      act(() => controller().syncFollowLive(true));
      expect(controller().intentRef.current?.kind).toBe('followLive');

      geometry.setScrollTop(100 - (LIVE_EDGE_THRESHOLD_PX + 10));
      act(() => controller().syncFollowLive(false));
      expect(controller().intentRef.current?.kind).toBe('free');
    });

    it('keeps followLive when the bottom sentinel leaves view within the release threshold', () => {
      vi.spyOn(document, 'hasFocus').mockReturnValue(true);
      const isInLivePaginationWindowRef = ref(true);
      const { controller, scrollElement } = renderController(isInLivePaginationWindowRef);
      const geometry = stubScrollGeometry(scrollElement, { scrollHeight: 500, offsetHeight: 400 });
      act(() => controller().syncFollowLive(true));
      expect(controller().intentRef.current?.kind).toBe('followLive');

      geometry.setScrollTop(100 - (LIVE_EDGE_THRESHOLD_PX - 10));
      act(() => controller().syncFollowLive(false));
      expect(controller().intentRef.current?.kind).toBe('followLive');
    });

    it('keeps followLive when drift happens unfocused without user scrolling', () => {
      vi.spyOn(document, 'hasFocus').mockReturnValue(false);
      const isInLivePaginationWindowRef = ref(true);
      const { controller, scrollElement } = renderController(isInLivePaginationWindowRef);
      const geometry = stubScrollGeometry(scrollElement, { scrollHeight: 500, offsetHeight: 400 });
      act(() => controller().syncFollowLive(true));
      expect(controller().intentRef.current?.kind).toBe('followLive');

      geometry.setScrollTop(100 - (LIVE_EDGE_THRESHOLD_PX + 200));
      act(() => controller().syncFollowLive(false));
      expect(controller().intentRef.current?.kind).toBe('followLive');
    });

    it('demotes followLive on drift after the user scrolls while unfocused', () => {
      vi.spyOn(document, 'hasFocus').mockReturnValue(false);
      const isInLivePaginationWindowRef = ref(true);
      const { controller, scrollElement } = renderController(isInLivePaginationWindowRef);
      const geometry = stubScrollGeometry(scrollElement, { scrollHeight: 500, offsetHeight: 400 });
      act(() => controller().syncFollowLive(true));
      expect(controller().intentRef.current?.kind).toBe('followLive');

      act(() => {
        scrollElement.dispatchEvent(new Event('wheel'));
      });
      geometry.setScrollTop(100 - (LIVE_EDGE_THRESHOLD_PX + 10));
      act(() => controller().syncFollowLive(false));
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
