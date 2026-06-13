import { atom, useSetAtom } from 'jotai';
import { useCallback, useEffect, useRef } from 'react';

export const ROUTE_GATE_DEADLINE_MS = 800;
export const TIMELINE_GATE_DEADLINE_MS = 800;

const pendingAtom = atom(0);

export const overlayVisibleAtom = atom((get) => get(pendingAtom) > 0);

export function useReadinessGate(label: string, ready: boolean, deadlineMs?: number) {
  const setPending = useSetAtom(pendingAtom);
  const settledRef = useRef(false);

  const settle = useCallback(
    (timedOut: boolean) => {
      if (settledRef.current) return;
      settledRef.current = true;
      setPending((count) => count - 1);
      if (timedOut) {
        // eslint-disable-next-line no-console
        console.warn(`readiness: ${label} gate timed out after ${deadlineMs}ms`);
      }
    },
    [setPending, label, deadlineMs]
  );

  useEffect(() => {
    setPending((count) => count + 1);
    const timeoutId =
      deadlineMs === undefined ? undefined : window.setTimeout(() => settle(true), deadlineMs);
    return () => {
      if (timeoutId !== undefined) window.clearTimeout(timeoutId);
      settle(false);
    };
  }, [setPending, settle, deadlineMs]);

  useEffect(() => {
    if (ready) settle(false);
  }, [ready, settle]);
}
