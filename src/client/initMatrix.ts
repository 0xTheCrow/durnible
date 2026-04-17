import type { MatrixClient } from 'matrix-js-sdk';
import { createClient, IndexedDBStore, IndexedDBCryptoStore } from 'matrix-js-sdk';
import { logger } from 'matrix-js-sdk/lib/logger';

import { cryptoCallbacks } from './secretStorageKeys';
import { clearNavToActivePathStore } from '../app/state/navToActivePath';
import { startupMark } from '../app/utils/startupPerf';

(logger as unknown as { setLevel: (level: string) => void }).setLevel('warn');

type Session = {
  baseUrl: string;
  accessToken: string;
  userId: string;
  deviceId: string;
};

export const initClient = async (session: Session): Promise<MatrixClient> => {
  startupMark('init-client-start');
  const indexedDBStore = new IndexedDBStore({
    indexedDB: global.indexedDB,
    localStorage: global.localStorage,
    dbName: 'web-sync-store',
  });

  const legacyCryptoStore = new IndexedDBCryptoStore(global.indexedDB, 'crypto-store');

  const mx = createClient({
    baseUrl: session.baseUrl,
    accessToken: session.accessToken,
    userId: session.userId,
    store: indexedDBStore,
    cryptoStore: legacyCryptoStore,
    deviceId: session.deviceId,
    timelineSupport: true,
    cryptoCallbacks,
    verificationMethods: ['m.sas.v1'],
  });

  startupMark('store-startup-start');
  await indexedDBStore.startup();
  startupMark('store-startup-end');

  startupMark('crypto-init-start');
  await mx.initRustCrypto();
  startupMark('crypto-init-end');

  mx.setMaxListeners(50);
  (mx as unknown as { logger: { setLevel: (level: string) => void } }).logger.setLevel('warn');

  startupMark('init-client-end');
  return mx;
};

export const startClient = async (mx: MatrixClient) => {
  startupMark('start-client-start');
  await mx.startClient({
    lazyLoadMembers: true,
  });
  startupMark('start-client-end');
};

export const clearCacheAndReload = async (mx: MatrixClient) => {
  mx.stopClient();
  clearNavToActivePathStore(mx.getSafeUserId());
  await mx.store.deleteAllData();
  window.location.reload();
};

export const logoutClient = async (mx: MatrixClient) => {
  mx.stopClient();
  try {
    await mx.logout();
  } catch {
    // ignore if failed to logout
  }
  await mx.clearStores();
  window.localStorage.clear();
  window.location.reload();
};

export const clearLoginData = async () => {
  const dbs = await window.indexedDB.databases();

  dbs.forEach((idbInfo) => {
    const { name } = idbInfo;
    if (name) {
      window.indexedDB.deleteDatabase(name);
    }
  });

  window.localStorage.clear();
  window.location.reload();
};
