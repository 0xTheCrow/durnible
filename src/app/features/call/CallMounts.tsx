import React, { lazy, Suspense, useEffect, useState } from 'react';
import { useAtomValue } from 'jotai';
import { callPreJoinRoomIdAtom, callStateAtom } from '../../state/call';
import {
  respondDesktopScreenshareSource,
  subscribeDesktopScreenshareSourceRequest,
} from '../../platform/desktop';
import type {
  DesktopScreenshareSourceChoice,
  DesktopScreenshareSourceRequest,
} from '../../platform/desktop';

const LazyCallBar = lazy(() => import('./CallBar').then((module) => ({ default: module.CallBar })));
const LazyCallScreen = lazy(() =>
  import('./CallScreen').then((module) => ({ default: module.CallScreen }))
);
const LazyCallPane = lazy(() =>
  import('./CallPane').then((module) => ({ default: module.CallPane }))
);
const LazyScreenshareSourcePicker = lazy(() =>
  import('./ScreenshareSourcePicker').then((module) => ({
    default: module.ScreenshareSourcePicker,
  }))
);

const useIsCallActive = (): boolean => {
  const callState = useAtomValue(callStateAtom);
  return callState.status !== 'idle' && callState.status !== 'failed';
};

const useIsCallSurfaceVisible = (): boolean => {
  const isCallActive = useIsCallActive();
  const preJoinRoomId = useAtomValue(callPreJoinRoomIdAtom);
  return isCallActive || preJoinRoomId !== undefined;
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
  const isCallSurfaceVisible = useIsCallSurfaceVisible();
  if (!isCallSurfaceVisible) return null;
  return (
    <Suspense fallback={null}>
      <LazyCallScreen />
    </Suspense>
  );
}

export function CallPaneGate() {
  const isCallSurfaceVisible = useIsCallSurfaceVisible();
  if (!isCallSurfaceVisible) return null;
  return (
    <Suspense fallback={null}>
      <LazyCallPane />
    </Suspense>
  );
}

export function ScreenshareSourcePickerMount() {
  const [request, setRequest] = useState<DesktopScreenshareSourceRequest | null>(null);

  useEffect(() => subscribeDesktopScreenshareSourceRequest(setRequest), []);

  if (!request) return null;

  const handleComplete = (choice: DesktopScreenshareSourceChoice | null) => {
    respondDesktopScreenshareSource(request.requestId, choice);
    setRequest(null);
  };

  return (
    <Suspense fallback={null}>
      <LazyScreenshareSourcePicker request={request} onComplete={handleComplete} />
    </Suspense>
  );
}
