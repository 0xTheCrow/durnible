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
    let callCount = 0;
    const { result } = renderHook(() =>
      useAsyncCallback(async () => {
        callCount += 1;
        const thisCall = callCount;
        // First call takes longer than second
        if (thisCall === 1) {
          await new Promise((r) => setTimeout(r, 50));
          return 'slow';
        }
        return 'fast';
      })
    );

    act(() => {
      // The first (slow) call will be superseded and reject with 'Request replaced!' —
      // that rejection is intentional; suppress it so it doesn't fail the test.
      result.current[1]().catch(() => {});
      result.current[1](); // fast call — should win
    });

    await waitFor(() => {
      expect(result.current[0].status).toBe(AsyncStatus.Success);
    });

    expect((result.current[0] as { status: AsyncStatus.Success; data: string }).data).toBe('fast');
  });

});
