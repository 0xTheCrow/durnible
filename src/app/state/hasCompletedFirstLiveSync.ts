import type { MatrixClient } from 'matrix-js-sdk';
import { SyncState } from 'matrix-js-sdk';
import { atom, useSetAtom } from 'jotai';
import { useCallback, useEffect } from 'react';
import { useSyncState } from '../hooks/server/useSyncState';

export const hasCompletedFirstLiveSyncAtom = atom(false);

export const useBindHasCompletedFirstLiveSyncAtom = (
  mx: MatrixClient,
  firstLiveSyncAtom: typeof hasCompletedFirstLiveSyncAtom
) => {
  const setHasCompletedFirstLiveSync = useSetAtom(firstLiveSyncAtom);

  useEffect(() => {
    if (mx.getSyncState() === SyncState.Syncing) {
      setHasCompletedFirstLiveSync(true);
    }
  }, [mx, setHasCompletedFirstLiveSync]);

  useSyncState(
    mx,
    useCallback(
      (state) => {
        if (state === SyncState.Syncing) {
          setHasCompletedFirstLiveSync(true);
        }
      },
      [setHasCompletedFirstLiveSync]
    )
  );
};
