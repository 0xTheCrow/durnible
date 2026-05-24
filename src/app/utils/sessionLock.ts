const PING_INTERVAL_MS = 5000;
export const LOCK_EXPIRY_MS = 15000;

type LockKeys = {
  ping: string;
  owner: string;
  claimant: string;
};

export const lockKeys = (scope: string): LockKeys => ({
  ping: `durnible_session_lock_ping_${scope}`,
  owner: `durnible_session_lock_owner_${scope}`,
  claimant: `durnible_session_lock_claimant_${scope}`,
});

const randomId = (): string => {
  if (typeof window.crypto?.randomUUID === 'function') {
    return window.crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
};

export const checkSessionLockFree = (scope = 'global'): boolean => {
  const keys = lockKeys(scope);
  let lastPing: string | null;
  try {
    lastPing = window.localStorage.getItem(keys.ping);
  } catch {
    return true;
  }
  if (lastPing === null) return true;
  const timeAgo = Date.now() - parseInt(lastPing, 10);
  return LOCK_EXPIRY_MS - Math.max(timeAgo, 0) <= 0;
};

export const getSessionLock = async (
  onNewInstance: () => void | Promise<void>,
  scope = 'global'
): Promise<boolean> => {
  const keys = lockKeys(scope);
  const sessionId = randomId();
  let lockServicer: number | null = null;

  const checkLock = (): number => {
    if (window.localStorage.getItem(keys.claimant) !== sessionId) return -1;
    const lastPing = window.localStorage.getItem(keys.ping);
    if (lastPing === null) return 0;
    const timeAgo = Date.now() - parseInt(lastPing, 10);
    const remaining = LOCK_EXPIRY_MS - Math.max(timeAgo, 0);
    return remaining <= 0 ? 0 : remaining;
  };

  const serviceLock = (): void => {
    window.localStorage.setItem(keys.owner, sessionId);
    window.localStorage.setItem(keys.ping, Date.now().toString());
  };

  const clearOwnClaim = (): void => {
    if (lockServicer !== null) {
      window.clearInterval(lockServicer);
      lockServicer = null;
    }
    window.localStorage.removeItem(keys.ping);
    window.localStorage.removeItem(keys.owner);
  };

  const releaseLock = async (): Promise<void> => {
    await onNewInstance();
    clearOwnClaim();
  };

  const onStorageEvent = (event: StorageEvent): void => {
    if (event.key !== keys.claimant) return;
    if (window.localStorage.getItem(keys.claimant) === sessionId) return;
    window.removeEventListener('storage', onStorageEvent);
    releaseLock().catch((err) => console.error('sessionLock: failed to release lock', err));
  };

  const onPageHide = (): void => {
    if (lockServicer !== null) clearOwnClaim();
  };

  const raceStorageOrTimeout = (remainingMs: number): Promise<StorageEvent | undefined> =>
    new Promise((resolve) => {
      const onUpdate = (event: StorageEvent): void => {
        if (event.key === keys.ping || event.key === keys.claimant) {
          window.removeEventListener('storage', onUpdate);
          window.clearTimeout(timer);
          resolve(event);
        }
      };
      const timer = window.setTimeout(() => {
        window.removeEventListener('storage', onUpdate);
        resolve(undefined);
      }, remainingMs);
      window.addEventListener('storage', onUpdate);
    });

  const acquire = async (): Promise<boolean> => {
    const remaining = checkLock();
    if (remaining === 0) return true;
    if (remaining < 0) {
      await onNewInstance();
      return false;
    }
    const winner = await raceStorageOrTimeout(remaining);
    if (!(winner instanceof StorageEvent)) return true;
    return acquire();
  };

  try {
    window.localStorage.setItem(keys.claimant, sessionId);
  } catch {
    // Storage is unavailable; run without the lock rather than blocking startup.
    return true;
  }

  const acquired = await acquire();
  if (!acquired) return false;

  serviceLock();
  lockServicer = window.setInterval(serviceLock, PING_INTERVAL_MS);
  window.addEventListener('storage', onStorageEvent);
  window.addEventListener('pagehide', onPageHide);
  window.addEventListener('unload', onPageHide);

  return true;
};
