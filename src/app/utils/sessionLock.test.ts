import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { checkSessionLockFree, getSessionLock, lockKeys, LOCK_EXPIRY_MS } from './sessionLock';

const { ping: PING_KEY, claimant: CLAIMANT_KEY } = lockKeys('global');

beforeEach(() => {
  window.localStorage.clear();
});

afterEach(() => {
  // Releases any interval the acquired lock is servicing and clears its claim.
  window.dispatchEvent(new Event('pagehide'));
  vi.useRealTimers();
  vi.clearAllMocks();
  window.localStorage.clear();
});

const dispatchStorage = (key: string, newValue: string): void => {
  window.dispatchEvent(new StorageEvent('storage', { key, newValue }));
};

describe('getSessionLock', () => {
  it('acquires the lock when none is held', async () => {
    const onNewInstance = vi.fn();
    await expect(getSessionLock(onNewInstance)).resolves.toBe(true);
    expect(onNewInstance).not.toHaveBeenCalled();
  });

  it('waits for a fresh foreign lock and acquires once its ping goes stale', async () => {
    vi.useFakeTimers();
    window.localStorage.setItem(PING_KEY, String(Date.now()));

    const onNewInstance = vi.fn();
    const lockPromise = getSessionLock(onNewInstance);

    await vi.advanceTimersByTimeAsync(LOCK_EXPIRY_MS);

    await expect(lockPromise).resolves.toBe(true);
    expect(onNewInstance).not.toHaveBeenCalled();
  });

  it('releases the lock when another instance claims it while we hold it', async () => {
    const onNewInstance = vi.fn();
    await getSessionLock(onNewInstance);
    expect(window.localStorage.getItem(PING_KEY)).not.toBeNull();

    window.localStorage.setItem(CLAIMANT_KEY, 'other-session');
    dispatchStorage(CLAIMANT_KEY, 'other-session');

    await vi.waitFor(() => expect(onNewInstance).toHaveBeenCalledTimes(1));
    expect(window.localStorage.getItem(PING_KEY)).toBeNull();
  });

  it('resolves false when a newer instance claims the lock before acquisition completes', async () => {
    window.localStorage.setItem(PING_KEY, String(Date.now()));

    const onNewInstance = vi.fn();
    // The storage listener is registered synchronously inside getSessionLock,
    // before it suspends, so dispatching immediately reaches it.
    const lockPromise = getSessionLock(onNewInstance);

    window.localStorage.setItem(CLAIMANT_KEY, 'newer-session');
    dispatchStorage(CLAIMANT_KEY, 'newer-session');

    await expect(lockPromise).resolves.toBe(false);
    expect(onNewInstance).toHaveBeenCalledTimes(1);
  });
});

describe('checkSessionLockFree', () => {
  it('treats a fresh ping as held and a ping past the expiry as free', () => {
    window.localStorage.setItem(PING_KEY, String(Date.now()));
    expect(checkSessionLockFree()).toBe(false);

    window.localStorage.setItem(PING_KEY, String(Date.now() - LOCK_EXPIRY_MS - 1));
    expect(checkSessionLockFree()).toBe(true);
  });
});
