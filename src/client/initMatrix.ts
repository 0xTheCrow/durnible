import type { MatrixClient } from 'matrix-js-sdk';
import { createClient, IndexedDBStore, IndexedDBCryptoStore } from 'matrix-js-sdk';
import { logger as sdkModuleLogger, type Logger } from 'matrix-js-sdk/lib/logger';

import { cryptoCallbacks } from './secretStorageKeys';
import { clearNavToActivePathStore } from '../app/state/navToActivePath';
import { startupMark } from '../app/utils/startupPerf';
import { MEDIA_CACHE_BUCKETS } from '../app/utils/mediaCache';

const clearCachedMedia = async (): Promise<void> => {
  if ('caches' in window) {
    await Promise.all(
      Object.values(MEDIA_CACHE_BUCKETS).map((bucket) => caches.delete(bucket.cacheName))
    );
  }
};

(sdkModuleLogger as unknown as { setLevel: (level: string) => void }).setLevel('warn');

const createFilteredLogger = (prefix = ''): Logger => {
  const tag = prefix ? `[${prefix}]` : '';
  return {
    trace: () => {},
    debug: () => {},
    info: () => {},
    warn: (...args: unknown[]) => (tag ? console.warn(tag, ...args) : console.warn(...args)),
    error: (...args: unknown[]) => (tag ? console.error(tag, ...args) : console.error(...args)),
    getChild: (namespace: string) =>
      createFilteredLogger(prefix ? `${prefix} ${namespace}` : namespace),
  };
};

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
    logger: createFilteredLogger(),
  });

  startupMark('store-startup-start');
  await indexedDBStore.startup();
  startupMark('store-startup-end');

  startupMark('crypto-init-start');
  await mx.initRustCrypto();
  startupMark('crypto-init-end');

  mx.setMaxListeners(50);

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
  await clearCachedMedia();
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

  await clearCachedMedia();
  window.localStorage.clear();
  window.location.reload();
};
