import React, { useRef } from 'react';
import { render, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  findObserverOf,
  installIntersectionObserverStub,
  ioInstances,
} from '../timelineTestHelpers';
import { useIsLatestMessageBottomVisible } from './useIsLatestMessageBottomVisible';

type HarnessProps = {
  isInLivePaginationWindow: boolean;
  onRender: (isLatestMessageBottomVisible: boolean) => void;
  onChange?: (isVisible: boolean) => void;
};

function Harness({ isInLivePaginationWindow, onRender, onChange }: HarnessProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const latestMessageBottomRef = useRef<HTMLSpanElement>(null);
  const { isLatestMessageBottomVisible } = useIsLatestMessageBottomVisible({
    scrollRef,
    latestMessageBottomRef,
    isInLivePaginationWindow,
    onChange,
  });
  onRender(isLatestMessageBottomVisible);
  return (
    <div ref={scrollRef}>
      <span ref={latestMessageBottomRef} data-testid="latest-message-bottom" />
    </div>
  );
}

const renderHook = (isInLivePaginationWindow: boolean, onChange?: (isVisible: boolean) => void) => {
  let latest = false;
  const { container } = render(
    <Harness
      isInLivePaginationWindow={isInLivePaginationWindow}
      onRender={(value) => {
        latest = value;
      }}
      onChange={onChange}
    />
  );
  const anchorElement = container.querySelector(
    '[data-testid="latest-message-bottom"]'
  ) as HTMLElement;
  return {
    reportBottomVisible: (isIntersecting: boolean) =>
      act(() => {
        findObserverOf(anchorElement)?.trigger(isIntersecting);
      }),
    read: () => latest,
  };
};

beforeEach(() => {
  installIntersectionObserverStub();
});

afterEach(() => {
  ioInstances.length = 0;
});

describe('useIsLatestMessageBottomVisible', () => {
  it('is true when the rendered bottom is in view inside the live window', () => {
    const { reportBottomVisible, read } = renderHook(true);

    reportBottomVisible(true);

    expect(read()).toBe(true);
  });

  it('is false at the bottom of a window that stops short of the live timeline', () => {
    const { reportBottomVisible, read } = renderHook(false);

    reportBottomVisible(true);

    expect(read()).toBe(false);
  });

  it('is false in the live window while the rendered bottom is out of view', () => {
    const { reportBottomVisible, read } = renderHook(true);

    reportBottomVisible(false);

    expect(read()).toBe(false);
  });

  it('reports the raw intersection value to onChange synchronously', () => {
    const onChange = vi.fn();
    const { reportBottomVisible } = renderHook(true, onChange);

    reportBottomVisible(true);
    expect(onChange).toHaveBeenLastCalledWith(true);

    reportBottomVisible(false);
    expect(onChange).toHaveBeenLastCalledWith(false);
  });
});
