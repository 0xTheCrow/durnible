import React from 'react';
import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { useDebounce } from './useDebounce';

const WAIT = 200;

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('useDebounce', () => {
  it('does not call the callback before the wait elapses', () => {
    const cb = vi.fn();
    const { result } = renderHook(() => useDebounce(cb, { wait: WAIT }));

    act(() => { result.current('a'); });
    expect(cb).not.toHaveBeenCalled();
  });

  it('calls the callback once after the wait elapses', () => {
    const cb = vi.fn();
    const { result } = renderHook(() => useDebounce(cb, { wait: WAIT }));

    act(() => { result.current('a'); });
    act(() => { vi.runAllTimers(); });

    expect(cb).toHaveBeenCalledTimes(1);
    expect(cb).toHaveBeenCalledWith('a');
  });

  it('resets the timer on repeated calls and fires only once', () => {
    const cb = vi.fn();
    const { result } = renderHook(() => useDebounce(cb, { wait: WAIT }));

    act(() => {
      result.current('a');
      result.current('b');
      result.current('c');
    });
    act(() => { vi.runAllTimers(); });

    expect(cb).toHaveBeenCalledTimes(1);
    expect(cb).toHaveBeenCalledWith('c');
  });

  it('with immediate=true calls the callback on the leading edge', () => {
    const cb = vi.fn();
    const { result } = renderHook(() =>
      useDebounce(cb, { wait: WAIT, immediate: true })
    );

    act(() => { result.current('a'); });

    expect(cb).toHaveBeenCalledTimes(1);
    expect(cb).toHaveBeenCalledWith('a');
  });

  it('with immediate=true does not fire again on subsequent calls before wait', () => {
    const cb = vi.fn();
    const { result } = renderHook(() =>
      useDebounce(cb, { wait: WAIT, immediate: true })
    );

    act(() => {
      result.current('a'); // leading edge fires
      result.current('b'); // timer reset, no immediate
      result.current('c'); // timer reset, no immediate
    });

    // Only the leading edge has fired so far
    expect(cb).toHaveBeenCalledTimes(1);
    expect(cb).toHaveBeenCalledWith('a');

    // Timer fires (trailing edge)
    act(() => { vi.runAllTimers(); });
    expect(cb).toHaveBeenCalledTimes(2);
    expect(cb).toHaveBeenLastCalledWith('c');
  });
});
