import type { RefObject } from 'react';
import React, { useRef } from 'react';
import { render, act, fireEvent } from '@testing-library/react';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { JumpToLatestButton } from './JumpToLatestButton';
import { installResizeObserverStub, resizeObserverInstances } from './timelineTestHelpers';

type HarnessRow = { id: string; isMessage: boolean; top: number; bottom: number };

const VIEWPORT_TOP = 0;
const VIEWPORT_BOTTOM = 500;

const messageRow = (id: string, top: number, bottom: number): HarnessRow => ({
  id,
  isMessage: true,
  top,
  bottom,
});

const systemRow = (id: string, top: number, bottom: number): HarnessRow => ({
  id,
  isMessage: false,
  top,
  bottom,
});

const pendingFrameCallbacks = new Map<number, FrameRequestCallback>();
let nextFrameId = 1;
let originalResizeObserver: typeof ResizeObserver;

function Harness({
  rows,
  isInLivePaginationWindow = true,
}: {
  rows: HarnessRow[];
  isInLivePaginationWindow?: boolean;
}) {
  const scrollRef = useRef<HTMLDivElement>(null) as RefObject<HTMLDivElement>;
  const contentRef = useRef<HTMLDivElement>(null) as RefObject<HTMLDivElement>;
  return (
    <>
      <div ref={scrollRef} data-testid="timeline-scroll">
        <div ref={contentRef}>
          {rows.map((row) => (
            <div key={row.id} data-testid={row.id} data-is-message={row.isMessage || undefined}>
              {row.id}
            </div>
          ))}
          <span data-testid="latest-message-bottom" />
        </div>
      </div>
      <JumpToLatestButton
        scrollRef={scrollRef}
        contentRef={contentRef}
        isInLivePaginationWindow={isInLivePaginationWindow}
        onClick={() => undefined}
      />
    </>
  );
}

const getScrollElement = (container: HTMLElement) =>
  container.querySelector('[data-testid="timeline-scroll"]') as HTMLElement;

const getRow = (container: HTMLElement, id: string) =>
  container.querySelector(`[data-testid="${id}"]`) as HTMLElement;

const createRect = (top: number, bottom: number): DOMRect => ({
  top,
  bottom,
  left: 0,
  right: 0,
  width: 0,
  height: bottom - top,
  x: 0,
  y: top,
  toJSON: () => ({}),
});

const stubRect = (element: HTMLElement, top: number, bottom: number) => {
  vi.spyOn(element, 'getBoundingClientRect').mockReturnValue(createRect(top, bottom));
};

const placeRows = (container: HTMLElement, rows: HarnessRow[]) => {
  stubRect(getScrollElement(container), VIEWPORT_TOP, VIEWPORT_BOTTOM);
  rows.forEach((row) => stubRect(getRow(container, row.id), row.top, row.bottom));
};

const flushAnimationFrames = () => {
  act(() => {
    const callbacks = [...pendingFrameCallbacks.values()];
    pendingFrameCallbacks.clear();
    callbacks.forEach((callback) => callback(0));
  });
};

const getVisibility = (container: HTMLElement) =>
  container.querySelector('[data-testid="jump-to-latest-overlay"]')?.getAttribute('data-visible') ??
  null;

const renderTimeline = (rows: HarnessRow[], isInLivePaginationWindow = true) => {
  const result = render(
    <Harness rows={rows} isInLivePaginationWindow={isInLivePaginationWindow} />
  );
  placeRows(result.container, rows);
  flushAnimationFrames();
  return result;
};

describe('JumpToLatestButton', () => {
  beforeEach(() => {
    pendingFrameCallbacks.clear();
    vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
      const frameId = nextFrameId;
      nextFrameId += 1;
      pendingFrameCallbacks.set(frameId, callback);
      return frameId;
    });
    vi.stubGlobal('cancelAnimationFrame', (frameId: number) => {
      pendingFrameCallbacks.delete(frameId);
    });
    originalResizeObserver = globalThis.ResizeObserver;
    installResizeObserverStub();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    globalThis.ResizeObserver = originalResizeObserver;
    resizeObserverInstances.length = 0;
  });

  it('stays hidden while only the top of the latest message is on screen', () => {
    const { container } = renderTimeline([
      messageRow('first', 300, 380),
      messageRow('latest', 480, 560),
    ]);
    expect(getVisibility(container)).toBe('false');
  });

  it('shows once a scroll moves the latest message below the viewport', () => {
    const { container } = renderTimeline([messageRow('latest', 400, 480)]);
    expect(getVisibility(container)).toBe('false');

    stubRect(getRow(container, 'latest'), 520, 600);
    fireEvent.scroll(getScrollElement(container));
    flushAnimationFrames();

    expect(getVisibility(container)).toBe('true');
  });

  it('hides when a resize brings the latest message back on screen without a scroll event', () => {
    const { container } = renderTimeline([messageRow('latest', 520, 600)]);
    expect(getVisibility(container)).toBe('true');

    const scrollElement = getScrollElement(container);
    stubRect(getRow(container, 'latest'), 420, 500);
    act(() => {
      resizeObserverInstances
        .find((instance) => instance.observed.has(scrollElement))
        ?.trigger([scrollElement]);
    });
    flushAnimationFrames();

    expect(getVisibility(container)).toBe('false');
  });

  it('measures the new latest message after a render adds it', () => {
    const { container, rerender } = renderTimeline([messageRow('first', 400, 480)]);
    expect(getVisibility(container)).toBe('false');

    const nextRows = [messageRow('first', 400, 480), messageRow('arrived', 520, 600)];
    rerender(<Harness rows={nextRows} />);
    placeRows(container, nextRows);
    flushAnimationFrames();

    expect(getVisibility(container)).toBe('true');
  });

  it('ignores system rows after the latest message', () => {
    const { container } = renderTimeline([
      messageRow('latest', 400, 480),
      systemRow('member-join', 520, 560),
    ]);
    expect(getVisibility(container)).toBe('false');
  });

  it('shows outside the live window even with the latest rendered message on screen', () => {
    const { container } = renderTimeline([messageRow('latest', 400, 480)], false);
    expect(getVisibility(container)).toBe('true');
  });

  it('stays hidden in a live window with no message rows', () => {
    const { container } = renderTimeline([systemRow('member-join', 520, 560)]);
    expect(getVisibility(container)).toBe('false');
  });
});
