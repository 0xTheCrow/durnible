import React, { lazy, Suspense } from 'react';
import { useAtomValue } from 'jotai';
import { callStateAtom } from '../../state/call';

const LazyCallBar = lazy(() => import('./CallBar').then((module) => ({ default: module.CallBar })));
const LazyCallScreen = lazy(() =>
  import('./CallScreen').then((module) => ({ default: module.CallScreen }))
);
const LazyCallPane = lazy(() =>
  import('./CallPane').then((module) => ({ default: module.CallPane }))
);

const useIsCallActive = (): boolean => {
  const callState = useAtomValue(callStateAtom);
  return callState.status !== 'idle' && callState.status !== 'failed';
};

export function CallBarGate() {
  const isCallActive = useIsCallActive();
  if (!isCallActive) return null;
  return (
    <Suspense fallback={null}>
      <LazyCallBar />
    </Suspense>
  );
}

export function CallScreenGate() {
  const isCallActive = useIsCallActive();
  if (!isCallActive) return null;
  return (
    <Suspense fallback={null}>
      <LazyCallScreen />
    </Suspense>
  );
}

export function CallPaneGate() {
  const isCallActive = useIsCallActive();
  if (!isCallActive) return null;
  return (
    <Suspense fallback={null}>
      <LazyCallPane />
    </Suspense>
  );
}
