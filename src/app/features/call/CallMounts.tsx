import React, { lazy, Suspense, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { useAtom, useAtomValue } from 'jotai';
import { callPopOutAtom, callPreJoinRoomIdAtom, callStateAtom } from '../../state/call';
import { ScreenSize, useScreenSizeContext } from '../../hooks/browser/useScreenSize';
import { useCallPaneContainer } from './CallPaneContainer';
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
const LazyCallPopOutWindow = lazy(() =>
  import('./CallPopOut').then((module) => ({ default: module.CallPopOutWindow }))
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
  const screenSize = useScreenSizeContext();
  const { paneContainer } = useCallPaneContainer();
  if (!isCallSurfaceVisible || screenSize === ScreenSize.Mobile) return null;
  return createPortal(
    <Suspense fallback={null}>
      <LazyCallPane />
    </Suspense>,
    paneContainer
  );
}

export function CallPopOutGate() {
  const callState = useAtomValue(callStateAtom);
  const [callPopOut, setCallPopOut] = useAtom(callPopOutAtom);
  const connection =
    callState.status === 'connected' || callState.status === 'reconnecting'
      ? callState.connection
      : undefined;

  useEffect(() => {
    if (!connection) setCallPopOut(undefined);
  }, [connection, setCallPopOut]);

  if (!connection || !callPopOut) return null;
  return (
    <Suspense fallback={null}>
      <LazyCallPopOutWindow popOut={callPopOut} room={connection.matrixRoom} />
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
