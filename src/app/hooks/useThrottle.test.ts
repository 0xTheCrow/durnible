import React from 'react';
import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { useThrottle } from './useThrottle';

const WAIT = 200;

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('useThrottle', () => {
  it('does not call the callback before the wait elapses', () => {
    const cb = vi.fn();
    const { result } = renderHook(() => useThrottle(cb, { wait: WAIT }));

    act(() => { result.current('a'); });
    expect(cb).not.toHaveBeenCalled();
  });

  it('calls the callback once after the wait, with the last args', () => {
    const cb = vi.fn();
    const { result } = renderHook(() => useThrottle(cb, { wait: WAIT }));

    act(() => {
      result.current('a');
      result.current('b');
      result.current('c');
    });
    act(() => { vi.runAllTimers(); });

    expect(cb).toHaveBeenCalledTimes(1);
    expect(cb).toHaveBeenCalledWith('c');
  });

  it('only starts a new timer after the current one fires', () => {
    const cb = vi.fn();
    const { result } = renderHook(() => useThrottle(cb, { wait: WAIT }));

    act(() => { result.current('first'); });
    act(() => { vi.runAllTimers(); }); // fires with 'first'

    act(() => { result.current('second'); });
    act(() => { vi.runAllTimers(); }); // fires with 'second'

    expect(cb).toHaveBeenCalledTimes(2);
    expect(cb).toHaveBeenNthCalledWith(1, 'first');
    expect(cb).toHaveBeenNthCalledWith(2, 'second');
  });

  it('with immediate=true calls the callback on the leading edge', () => {
    const cb = vi.fn();
    const { result } = renderHook(() =>
      useThrottle(cb, { wait: WAIT, immediate: true })
    );

    act(() => { result.current('a'); });

    expect(cb).toHaveBeenCalledTimes(1);
    expect(cb).toHaveBeenCalledWith('a');
  });

  it('with immediate=true subsequent calls during wait do not fire immediately', () => {
    const cb = vi.fn();
    const { result } = renderHook(() =>
      useThrottle(cb, { wait: WAIT, immediate: true })
    );

    act(() => {
      result.current('a'); // leading edge fires
      result.current('b'); // throttled
      result.current('c'); // throttled, updates stored args
    });

    expect(cb).toHaveBeenCalledTimes(1);
    expect(cb).toHaveBeenCalledWith('a');

    // Timer fires with the latest args
    act(() => { vi.runAllTimers(); });
    expect(cb).toHaveBeenCalledTimes(2);
    expect(cb).toHaveBeenLastCalledWith('c');
  });
});
