import { SyncState } from 'matrix-js-sdk';
import { useCallback, useState } from 'react';
import { useMatrixClient } from './useMatrixClient';
import { useSyncState } from './useSyncState';

export type ConnectionStatus = 'connecting' | 'reconnecting' | 'error' | null;

export const useConnectionStatus = (): ConnectionStatus => {
  const mx = useMatrixClient();
  const [status, setStatus] = useState<ConnectionStatus>(null);

  useSyncState(
    mx,
    useCallback((current: SyncState | null, previous: SyncState | null | undefined) => {
      const connecting =
        (current === SyncState.Prepared ||
          current === SyncState.Syncing ||
          current === SyncState.Catchup) &&
        previous !== SyncState.Syncing;

      if (current === SyncState.Error) {
        setStatus('error');
      } else if (current === SyncState.Reconnecting) {
        setStatus('reconnecting');
      } else if (connecting) {
        setStatus('connecting');
      } else {
        setStatus(null);
      }
    }, [])
  );

  return status;
};
