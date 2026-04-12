import { renderHook, act, waitFor } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { useAsyncCallback, useAutoLoadAsyncCallback, AsyncStatus } from './useAsyncCallback';

describe('useAsyncCallback', () => {
  it('starts in idle state', () => {
    const { result } = renderHook(() => useAsyncCallback(async () => 'data'));
    expect(result.current[0].status).toBe(AsyncStatus.Idle);
  });

  it('transitions to success with returned data', async () => {
    const { result } = renderHook(() => useAsyncCallback(async () => 'hello'));

    act(() => {
      result.current[1]();
    });

    await waitFor(() => {
      expect(result.current[0].status).toBe(AsyncStatus.Success);
    });

    expect((result.current[0] as { status: AsyncStatus.Success; data: string }).data).toBe('hello');
  });

  it('transitions to error when the callback rejects', async () => {
    const error = new Error('boom');
    const { result } = renderHook(() =>
      useAsyncCallback(async () => {
        throw error;
      })
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
          ? new Promise<string>((res) => {
              resolveSlow = res;
            })
          : new Promise<string>((res) => {
              resolveFast = res;
            });
      })
    );

    act(() => {
      // First call will be superseded — suppress the intentional 'Request replaced!' rejection.
      result.current[1]().catch(() => {});
      result.current[1](); // second call should win
    });

    // Resolve the fast (second) call first
    await act(async () => {
      resolveFast('fast');
    });

    await waitFor(() => {
      expect(result.current[0].status).toBe(AsyncStatus.Success);
    });
    expect((result.current[0] as { status: AsyncStatus.Success; data: string }).data).toBe('fast');

    // Resolving the slow (first) call afterwards must not overwrite the result
    await act(async () => {
      resolveSlow('slow');
    });
    expect((result.current[0] as { status: AsyncStatus.Success; data: string }).data).toBe('fast');
  });
});

describe('useAutoLoadAsyncCallback', () => {
  it('auto-loads once on mount when enabled', async () => {
    const loader = vi.fn(async () => 'value');
    const { result } = renderHook(() => useAutoLoadAsyncCallback(loader, true));

    await waitFor(() => {
      expect(result.current[0].status).toBe(AsyncStatus.Success);
    });
    expect(loader).toHaveBeenCalledTimes(1);
    expect((result.current[0] as { status: AsyncStatus.Success; data: string }).data).toBe('value');
  });

  it('does not auto-load while disabled', async () => {
    const loader = vi.fn(async () => 'value');
    const { result, rerender } = renderHook(
      ({ enabled }: { enabled: boolean }) => useAutoLoadAsyncCallback(loader, enabled),
      { initialProps: { enabled: false } }
    );

    // Give the effect a chance to run — it should NOT fire while disabled.
    await act(async () => {});
    expect(result.current[0].status).toBe(AsyncStatus.Idle);
    expect(loader).not.toHaveBeenCalled();

    // Flip to enabled — loader should fire once.
    rerender({ enabled: true });
    await waitFor(() => {
      expect(result.current[0].status).toBe(AsyncStatus.Success);
    });
    expect(loader).toHaveBeenCalledTimes(1);
  });

  it('does NOT re-fire when the callback identity changes after the first load (one-shot)', async () => {
    // Simulates the upstream-churn scenario that caused the image/video remount
    // bug: a parent re-render produces a new `asyncCallback` reference every
    // render. Without the Idle gate, that causes the effect to re-fire after
    // Success, dispatch Loading, and remount any <img>/<video> rendered on
    // Success. The gate makes the load strictly one-shot per mount.
    const asyncFn = vi.fn(async () => 'value');
    const { result, rerender } = renderHook(() =>
      // New callback identity on every render.
      useAutoLoadAsyncCallback(async () => asyncFn(), true)
    );

    await waitFor(() => {
      expect(result.current[0].status).toBe(AsyncStatus.Success);
    });
    expect(asyncFn).toHaveBeenCalledTimes(1);

    // Force several re-renders — each produces a new callback identity.
    for (let i = 0; i < 5; i += 1) {
      rerender();
      // eslint-disable-next-line no-await-in-loop
      await act(async () => {});
    }

    // The loader must not have been invoked again.
    expect(asyncFn).toHaveBeenCalledTimes(1);
    expect(result.current[0].status).toBe(AsyncStatus.Success);
  });

  it('allows manual retry by calling load directly even after the gate has closed', async () => {
    // The Idle gate only guards the auto-load effect. A manual call to the
    // returned loader (e.g. from a Retry button) must still work, otherwise
    // failed loads would be unrecoverable.
    let shouldFail = true;
    const loader = vi.fn(async () => {
      if (shouldFail) throw new Error('boom');
      return 'recovered';
    });

    const { result } = renderHook(() => useAutoLoadAsyncCallback(loader, true));

    await waitFor(() => {
      expect(result.current[0].status).toBe(AsyncStatus.Error);
    });
    expect(loader).toHaveBeenCalledTimes(1);

    // Simulate the user clicking a retry button.
    shouldFail = false;
    await act(async () => {
      await result.current[1]().catch(() => {});
    });

    await waitFor(() => {
      expect(result.current[0].status).toBe(AsyncStatus.Success);
    });
    expect(loader).toHaveBeenCalledTimes(2);
    expect((result.current[0] as { status: AsyncStatus.Success; data: string }).data).toBe(
      'recovered'
    );
  });
});
