import { useCallback, useEffect, useRef, useState } from 'react';
import { flushSync } from 'react-dom';
import { useAlive } from './useAlive';

export enum AsyncStatus {
  Idle = 'idle',
  Loading = 'loading',
  Success = 'success',
  Error = 'error',
}

export type AsyncIdle = {
  status: AsyncStatus.Idle;
};

export type AsyncLoading = {
  status: AsyncStatus.Loading;
};

export type AsyncSuccess<D> = {
  status: AsyncStatus.Success;
  data: D;
};

export type AsyncError<E = unknown> = {
  status: AsyncStatus.Error;
  error: E;
};

export type AsyncState<D, E = unknown> = AsyncIdle | AsyncLoading | AsyncSuccess<D> | AsyncError<E>;

export type AsyncCallback<TArgs extends unknown[], TData> = (...args: TArgs) => Promise<TData>;

export const useAsync = <TData, TError, TArgs extends unknown[]>(
  asyncCallback: AsyncCallback<TArgs, TData>,
  onStateChange: (state: AsyncState<TData, TError>) => void
): AsyncCallback<TArgs, TData> => {
  const alive = useAlive();

  // Tracks the request number.
  // If two or more requests are made subsequently
  // we will throw all old request's response after they resolved.
  const reqNumberRef = useRef(0);

  const callback: AsyncCallback<TArgs, TData> = useCallback(
    async (...args) => {
      queueMicrotask(() => {
        // Warning: flushSync was called from inside a lifecycle method.
        // React cannot flush when React is already rendering.
        // Consider moving this call to a scheduler task or micro task.
        flushSync(() => {
          // flushSync because
          // https://github.com/facebook/react/issues/26713#issuecomment-1872085134
          onStateChange({
            status: AsyncStatus.Loading,
          });
        });
      });

      reqNumberRef.current += 1;

      const currentReqNumber = reqNumberRef.current;
      try {
        const data = await asyncCallback(...args);
        if (currentReqNumber !== reqNumberRef.current) {
          throw new Error('AsyncCallbackHook: Request replaced!');
        }
        if (alive()) {
          queueMicrotask(() => {
            onStateChange({
              status: AsyncStatus.Success,
              data,
            });
          });
        }
        return data;
      } catch (e) {
        if (currentReqNumber !== reqNumberRef.current) {
          throw new Error('AsyncCallbackHook: Request replaced!');
        }

        if (alive()) {
          queueMicrotask(() => {
            onStateChange({
              status: AsyncStatus.Error,
              error: e as TError,
            });
          });
        }
        throw e;
      }
    },
    [asyncCallback, alive, onStateChange]
  );

  return callback;
};

export const useAsyncCallback = <TData, TError, TArgs extends unknown[]>(
  asyncCallback: AsyncCallback<TArgs, TData>
): [AsyncState<TData, TError>, AsyncCallback<TArgs, TData>] => {
  const [state, setState] = useState<AsyncState<TData, TError>>({
    status: AsyncStatus.Idle,
  });

  const callback = useAsync(asyncCallback, setState);

  return [state, callback];
};

export const useAsyncCallbackValue = <TData, TError>(
  asyncCallback: AsyncCallback<[], TData>
): [AsyncState<TData, TError>, AsyncCallback<[], TData>] => {
  const [state, load] = useAsyncCallback<TData, TError, []>(asyncCallback);

  useEffect(() => {
    load();
  }, [load]);

  return [state, load];
};

// Like useAsyncCallback, but auto-invokes the loader once while `enabled` is
// true and state is Idle. The Idle gate makes the auto-load strictly one-shot
// per load lifecycle: once state has transitioned past Idle, subsequent
// re-renders that change the loader's identity (e.g. content.file ref churn
// from an upstream render when a newer message arrives) will NOT re-fire the
// effect. Without the gate, the re-fire dispatches Loading → unmounts any
// <img>/<video> rendered on Success → produces a fresh blob URL → remounts
// with a new src → visible unload/reload flash.
//
// Use `useAsyncCallbackValue` instead when the load SHOULD re-fire on dep
// changes (e.g. userId → reload mutual rooms). Retrying a failed load must
// still be done by calling `load` directly (bypasses the effect's gate).
export const useAutoLoadAsyncCallback = <TData, TError>(
  asyncCallback: AsyncCallback<[], TData>,
  enabled: boolean
): [AsyncState<TData, TError>, AsyncCallback<[], TData>] => {
  const [state, load] = useAsyncCallback<TData, TError, []>(asyncCallback);

  useEffect(() => {
    // Swallow the rejection here — errors are still observable to callers
    // via `state.status === AsyncStatus.Error`. Without this catch, a failed
    // load would surface as an unhandled promise rejection.
    if (enabled && state.status === AsyncStatus.Idle) load().catch(() => {});
  }, [enabled, state.status, load]);

  return [state, load];
};
