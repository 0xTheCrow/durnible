import { useCallback, useEffect, useState } from 'react';
import { checkIsNativeMobileApp } from '../platform/mobile';
import {
  getSystemNotificationPermission,
  requestSystemNotificationPermission,
} from '../utils/systemNotifications';
import { getNotificationState, usePermissionState } from './usePermission';

export function useSystemNotificationPermission(): [PermissionState, () => void] {
  const [permission, setPermission] = useState<PermissionState>(() =>
    checkIsNativeMobileApp() ? 'prompt' : getNotificationState()
  );
  const webPermission = usePermissionState('notifications', getNotificationState());

  useEffect(() => {
    if (!checkIsNativeMobileApp()) setPermission(webPermission);
  }, [webPermission]);

  useEffect(() => {
    let isActive = true;

    if (checkIsNativeMobileApp()) {
      getSystemNotificationPermission().then((state) => {
        if (isActive) setPermission(state);
      });
    }

    return () => {
      isActive = false;
    };
  }, []);

  const requestPermission = useCallback(() => {
    requestSystemNotificationPermission().then(setPermission);
  }, []);

  return [permission, requestPermission];
}
