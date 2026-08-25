import type { ReactNode } from 'react';
import React, { createContext, lazy, Suspense, useCallback, useContext, useMemo } from 'react';
import { useAtomValue, useSetAtom } from 'jotai';
import type { Room } from 'matrix-js-sdk';
import { useMatrixClient } from '../../hooks/useMatrixClient';
import { useLivekitFoci } from '../../hooks/useLivekitFoci';
import { useSetting } from '../../state/hooks/settings';
import { settingsAtom } from '../../state/settings';
import { callStateAtom } from '../../state/call';

const LazyCallEngineMount = lazy(() =>
  import('./CallEngineMount').then((module) => ({ default: module.CallEngineMount }))
);

type CallActions = {
  startCall: (room: Room) => Promise<void>;
  endCall: () => Promise<void>;
};

const CallActionsContext = createContext<CallActions | null>(null);

export const useCallActions = (): CallActions => {
  const callActions = useContext(CallActionsContext);
  if (!callActions) throw new Error('useCallActions used outside of CallProvider');
  return callActions;
};

export function CallProvider({ children }: { children: ReactNode }) {
  const matrixClient = useMatrixClient();
  const callState = useAtomValue(callStateAtom);
  const setCallState = useSetAtom(callStateAtom);
  const livekitFoci = useLivekitFoci();
  const [preferredAudioInputDeviceId] = useSetting(settingsAtom, 'preferredAudioInputDeviceId');
  const [preferredVideoInputDeviceId] = useSetting(settingsAtom, 'preferredVideoInputDeviceId');
  const [preferredAudioOutputDeviceId] = useSetting(settingsAtom, 'preferredAudioOutputDeviceId');

  const startCall = useCallback(
    async (room: Room) => {
      const { startCall: startLazyCall } = await import('../../plugins/call/callActions');
      await startLazyCall(
        matrixClient,
        room,
        livekitFoci,
        {
          audioInputDeviceId: preferredAudioInputDeviceId,
          videoInputDeviceId: preferredVideoInputDeviceId,
          audioOutputDeviceId: preferredAudioOutputDeviceId,
        },
        () => callState,
        setCallState
      );
    },
    [
      matrixClient,
      callState,
      livekitFoci,
      preferredAudioInputDeviceId,
      preferredVideoInputDeviceId,
      preferredAudioOutputDeviceId,
      setCallState,
    ]
  );

  const endCall = useCallback(async () => {
    const { endCall: endLazyCall } = await import('../../plugins/call/callActions');
    await endLazyCall(() => callState, setCallState);
  }, [callState, setCallState]);

  const callActions = useMemo(() => ({ startCall, endCall }), [startCall, endCall]);

  const isCallActive = callState.status !== 'idle' && callState.status !== 'failed';

  return (
    <CallActionsContext.Provider value={callActions}>
      {children}
      {isCallActive && (
        <Suspense fallback={null}>
          <LazyCallEngineMount />
        </Suspense>
      )}
    </CallActionsContext.Provider>
  );
}
