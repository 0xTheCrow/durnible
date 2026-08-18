import { useEffect } from 'react';

export const checkIsScreenWakeLockSupported = (): boolean => 'wakeLock' in navigator;

export const useScreenWakeLock = (isEnabled: boolean): void => {
  useEffect(() => {
    if (!isEnabled || !checkIsScreenWakeLockSupported()) return undefined;

    let sentinel: WakeLockSentinel | undefined;
    let isCancelled = false;

    const requestWakeLock = () => {
      navigator.wakeLock
        .request('screen')
        .then((nextSentinel) => {
          if (isCancelled) {
            nextSentinel.release().catch(() => undefined);
            return;
          }
          sentinel = nextSentinel;
        })
        .catch(() => undefined);
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && sentinel?.released !== false) {
        requestWakeLock();
      }
    };

    requestWakeLock();
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      isCancelled = true;
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      sentinel?.release().catch(() => undefined);
    };
  }, [isEnabled]);
};
