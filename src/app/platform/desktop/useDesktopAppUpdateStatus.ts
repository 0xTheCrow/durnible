import { useEffect, useRef, useState } from 'react';
import type { DesktopAppUpdateStatus } from './bridge';
import { getDesktopAppUpdateStatus, subscribeDesktopAppUpdateStatus } from './bridge';

export const useDesktopAppUpdateStatus = (): DesktopAppUpdateStatus => {
  const [status, setStatus] = useState<DesktopAppUpdateStatus>({ availability: 'unsupported' });
  const hasReceivedPushedStatus = useRef(false);

  useEffect(() => {
    const unsubscribe = subscribeDesktopAppUpdateStatus((pushedStatus) => {
      hasReceivedPushedStatus.current = true;
      setStatus(pushedStatus);
    });

    getDesktopAppUpdateStatus()
      .then((initialStatus) => {
        if (hasReceivedPushedStatus.current) return;
        setStatus(initialStatus);
      })
      .catch(() => undefined);

    return unsubscribe;
  }, []);

  return status;
};
