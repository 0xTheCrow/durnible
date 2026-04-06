import React from 'react';
import { renderHook, act, waitFor } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { useAsyncCallback, AsyncStatus } from './useAsyncCallback';

describe('useAsyncCallback', () => {
  it('starts in idle state', () => {
    const { result } = renderHook(() => useAsyncCallback(async () => 'data'));
    expect(result.current[0].status).toBe(AsyncStatus.Idle);
  });

  it('transitions to success with returned data', async () => {
    const { result } = renderHook(() => useAsyncCallback(async () => 'hello'));

    act(() => { result.current[1](); });

    await waitFor(() => {
      expect(result.current[0].status).toBe(AsyncStatus.Success);
    });

    expect((result.current[0] as { status: AsyncStatus.Success; data: string }).data).toBe('hello');
  });

  it('transitions to error when the callback rejects', async () => {
    const error = new Error('boom');
    const { result } = renderHook(() =>
      useAsyncCallback(async () => { throw error; })
    );

    act(() => {
      // suppress the unhandled rejection that propagates out of the hook
      result.current[1]().catch(() => {});
    });

    await waitFor(() => {
      expect(result.current[0].status).toBe(AsyncStatus.Error);
    });

    expect((result.current[0] as { status: AsyncStatus.Error; error: Error }).error).toBe(error);
  });

  it('discards stale responses when called multiple times rapidly', async () => {
    // Use deferred promises so we control resolution order without real timers.
    let resolveSlow!: (v: string) => void;
    let resolveFast!: (v: string) => void;
    let callCount = 0;

    const { result } = renderHook(() =>
      useAsyncCallback(async () => {
        callCount += 1;
        return callCount === 1
          ? new Promise<string>((res) => { resolveSlow = res; })
          : new Promise<string>((res) => { resolveFast = res; });
      })
    );

    act(() => {
      // First call will be superseded — suppress the intentional 'Request replaced!' rejection.
      result.current[1]().catch(() => {});
      result.current[1](); // second call should win
    });

    // Resolve the fast (second) call first
    await act(async () => { resolveFast('fast'); });

    await waitFor(() => {
      expect(result.current[0].status).toBe(AsyncStatus.Success);
    });
    expect((result.current[0] as { status: AsyncStatus.Success; data: string }).data).toBe('fast');

    // Resolving the slow (first) call afterwards must not overwrite the result
    await act(async () => { resolveSlow('slow'); });
    expect((result.current[0] as { status: AsyncStatus.Success; data: string }).data).toBe('fast');
  });

});
