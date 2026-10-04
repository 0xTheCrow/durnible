import { useCallback, useEffect, useState } from 'react';
import { checkIsNativeMobileApp } from '../platform/mobile';
import {
  getSystemNotificationPermission,
  getWebNotificationPermission,
  requestSystemNotificationPermission,
} from '../utils/systemNotifications';

export function useSystemNotificationPermission(): [PermissionState, () => void] {
  const [permission, setPermission] = useState<PermissionState>(() =>
    checkIsNativeMobileApp() ? 'prompt' : getWebNotificationPermission()
  );

  useEffect(() => {
    if (checkIsNativeMobileApp()) {
      let isActive = true;
      getSystemNotificationPermission().then((state) => {
        if (isActive) setPermission(state);
      });
      return () => {
        isActive = false;
      };
    }

    let permissionStatus: PermissionStatus | undefined;
    const handlePermissionChange = () => {
      if (permissionStatus) setPermission(permissionStatus.state);
    };
    navigator.permissions
      .query({ name: 'notifications' })
      .then((status) => {
        permissionStatus = status;
        handlePermissionChange();
        status.addEventListener('change', handlePermissionChange);
      })
      .catch(() => undefined);
    return () => permissionStatus?.removeEventListener('change', handlePermissionChange);
  }, []);

  const requestPermission = useCallback(() => {
    requestSystemNotificationPermission().then(setPermission);
  }, []);

  return [permission, requestPermission];
}
