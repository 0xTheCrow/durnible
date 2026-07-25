import type { ReactNode } from 'react';
import React, { createContext, useContext, useMemo } from 'react';
import type { Room } from 'matrix-js-sdk';
import { useCallLifecycle } from '../../hooks/call/useCallLifecycle';
import { CallAudioRenderer } from './CallAudioRenderer';

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
  const { startCall, endCall } = useCallLifecycle();
  const callActions = useMemo(() => ({ startCall, endCall }), [startCall, endCall]);

  return (
    <CallActionsContext.Provider value={callActions}>
      {children}
      <CallAudioRenderer />
    </CallActionsContext.Provider>
  );
}
