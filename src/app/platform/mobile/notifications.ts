import type { PluginListenerHandle } from '@capacitor/core';
import { LocalNotifications } from '@capacitor/local-notifications';
import { checkIsNativeMobileApp } from '.';

const NOTIFICATION_CHANNEL_ID = 'durnible_messages_v1';

const toPermissionState = (
  displayPermission: Awaited<ReturnType<typeof LocalNotifications.checkPermissions>>['display']
): PermissionState => {
  if (displayPermission === 'granted') return 'granted';
  if (displayPermission === 'denied') return 'denied';
  return 'prompt';
};

export const prepareMobileNotifications = async (): Promise<void> => {
  if (!checkIsNativeMobileApp()) return;

  await LocalNotifications.createChannel({
    id: NOTIFICATION_CHANNEL_ID,
    name: 'Messages',
    description: 'New messages and invitations.',
    importance: 4,
  });
};

export const getMobileNotificationPermission = async (): Promise<PermissionState> => {
  if (!checkIsNativeMobileApp()) return 'denied';

  const status = await LocalNotifications.checkPermissions();
  return toPermissionState(status.display);
};

export const requestMobileNotificationPermission = async (): Promise<PermissionState> => {
  if (!checkIsNativeMobileApp()) return 'denied';

  const status = await LocalNotifications.requestPermissions();
  return toPermissionState(status.display);
};

export const showMobileNotification = async ({
  id,
  title,
  body,
  extra,
}: {
  id: number;
  title: string;
  body: string;
  extra?: unknown;
}): Promise<void> => {
  if (!checkIsNativeMobileApp()) return;

  await LocalNotifications.schedule({
    notifications: [
      {
        id,
        title,
        body,
        extra,
        channelId: NOTIFICATION_CHANNEL_ID,
        foreground: true,
        isExactNotification: false,
      },
    ],
  });
};

export const addMobileNotificationClickListener = (
  handleClick: (extra: unknown) => void
): Promise<PluginListenerHandle | undefined> => {
  if (!checkIsNativeMobileApp()) return Promise.resolve(undefined);

  return LocalNotifications.addListener('localNotificationActionPerformed', (action) => {
    handleClick(action.notification.extra);
  });
};
