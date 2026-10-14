const LIVENESS_DATABASE_NAME = 'durnible_indexeddb_liveness';
const LIVENESS_STORE_NAME = 'probe';
const LAST_RELOAD_STORAGE_KEY = 'durnible_indexeddb_liveness_last_reload';
export const LIVENESS_PROBE_TIMEOUT_MS = 2000;
export const LIVENESS_RELOAD_COOLDOWN_MS = 60000;

type LivenessConnection = {
  database: IDBDatabase;
  isClosedByUs: boolean;
};

let livenessConnection: Promise<LivenessConnection | undefined> | undefined;

const openLivenessConnection = (): Promise<LivenessConnection | undefined> =>
  new Promise((resolve) => {
    if (!window.indexedDB) {
      resolve(undefined);
      return;
    }
    let request: IDBOpenDBRequest;
    try {
      request = window.indexedDB.open(LIVENESS_DATABASE_NAME, 1);
    } catch {
      resolve(undefined);
      return;
    }
    request.onupgradeneeded = () => {
      request.result.createObjectStore(LIVENESS_STORE_NAME);
    };
    request.onsuccess = () => {
      const connection: LivenessConnection = { database: request.result, isClosedByUs: false };
      connection.database.onversionchange = () => {
        connection.isClosedByUs = true;
        connection.database.close();
      };
      resolve(connection);
    };
    request.onerror = () => resolve(undefined);
  });

export const openIndexedDBLivenessConnection = (): void => {
  livenessConnection ??= openLivenessConnection();
};

const checkIsConnectionReadable = (database: IDBDatabase): Promise<boolean> =>
  new Promise((resolve) => {
    try {
      const transaction = database.transaction(LIVENESS_STORE_NAME, 'readonly');
      transaction.objectStore(LIVENESS_STORE_NAME).count();
      transaction.oncomplete = () => resolve(true);
      transaction.onerror = () => resolve(false);
      transaction.onabort = () => resolve(false);
    } catch {
      resolve(false);
    }
  });

export const checkIsIndexedDBConnectionLost = async (): Promise<boolean> => {
  const connection = await livenessConnection;
  if (!connection || connection.isClosedByUs) return false;

  let probeTimeout: number | undefined;
  const assumeReadableAfterTimeout = new Promise<boolean>((resolve) => {
    probeTimeout = window.setTimeout(() => resolve(true), LIVENESS_PROBE_TIMEOUT_MS);
  });
  const isReadable = await Promise.race([
    checkIsConnectionReadable(connection.database),
    assumeReadableAfterTimeout,
  ]);
  window.clearTimeout(probeTimeout);

  return !isReadable && !connection.isClosedByUs;
};

export const tryReloadForLostIndexedDBConnection = (): boolean => {
  try {
    const lastReload = window.sessionStorage.getItem(LAST_RELOAD_STORAGE_KEY);
    if (
      lastReload !== null &&
      Date.now() - parseInt(lastReload, 10) < LIVENESS_RELOAD_COOLDOWN_MS
    ) {
      return false;
    }
    window.sessionStorage.setItem(LAST_RELOAD_STORAGE_KEY, Date.now().toString());
  } catch {
    return false;
  }
  window.location.reload();
  return true;
};
