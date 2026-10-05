import React from 'react';
import { renderHook, act } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { EventEmitter } from 'events';
import type { ReactNode } from 'react';
import type { MatrixClient } from 'matrix-js-sdk';
import { ClientEvent, SyncState } from 'matrix-js-sdk';
import { Provider, createStore, useAtomValue } from 'jotai';
import {
  hasCompletedFirstLiveSyncAtom,
  useBindHasCompletedFirstLiveSyncAtom,
} from './hasCompletedFirstLiveSync';

function makeEmittingClient(syncState: SyncState | null = null) {
  const emitter = new EventEmitter();
  return {
    on: emitter.on.bind(emitter),
    off: emitter.off.bind(emitter),
    removeListener: emitter.removeListener.bind(emitter),
    emit: emitter.emit.bind(emitter),
    getSyncState: () => syncState,
  };
}

const renderBoundFlag = (client: ReturnType<typeof makeEmittingClient>) => {
  const store = createStore();
  const wrapper = ({ children }: { children: ReactNode }) => (
    <Provider store={store}>{children}</Provider>
  );

  return renderHook(
    () => {
      useBindHasCompletedFirstLiveSyncAtom(
        client as unknown as MatrixClient,
        hasCompletedFirstLiveSyncAtom
      );
      return useAtomValue(hasCompletedFirstLiveSyncAtom);
    },
    { wrapper }
  );
};

describe('useBindHasCompletedFirstLiveSyncAtom', () => {
  it('stays true across a reconnect once a live sync has completed', () => {
    const client = makeEmittingClient();
    const { result } = renderBoundFlag(client);

    expect(result.current).toBe(false);

    act(() => {
      client.emit(ClientEvent.Sync, SyncState.Syncing, SyncState.Prepared);
    });
    expect(result.current).toBe(true);

    act(() => {
      client.emit(ClientEvent.Sync, SyncState.Reconnecting, SyncState.Syncing);
    });
    expect(result.current).toBe(true);

    act(() => {
      client.emit(ClientEvent.Sync, SyncState.Error, SyncState.Reconnecting);
    });
    expect(result.current).toBe(true);

    act(() => {
      client.emit(ClientEvent.Sync, SyncState.Catchup, SyncState.Error);
    });
    expect(result.current).toBe(true);
  });

  it('starts true when the client is already syncing before the binding mounts', () => {
    const { result } = renderBoundFlag(makeEmittingClient(SyncState.Syncing));

    expect(result.current).toBe(true);
  });

  it('starts false when the client has only prepared before the binding mounts', () => {
    const { result } = renderBoundFlag(makeEmittingClient(SyncState.Prepared));

    expect(result.current).toBe(false);
  });

  it('stays false while only a cached sync has prepared', () => {
    const client = makeEmittingClient();
    const { result } = renderBoundFlag(client);

    act(() => {
      client.emit(ClientEvent.Sync, SyncState.Prepared, null);
    });

    expect(result.current).toBe(false);
  });
});
