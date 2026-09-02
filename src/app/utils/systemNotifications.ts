import { getInboxInvitesPath } from '../pages/pathUtils';
import { checkIsNativeMobileApp } from '../platform/mobile';
import {
  addMobileNotificationClickListener,
  getMobileNotificationPermission,
  prepareMobileNotifications,
  requestMobileNotificationPermission,
  showMobileNotification,
} from '../platform/mobile/notifications';

export type SystemNotificationTarget =
  | { kind: 'inboxInvites' }
  | { kind: 'room'; roomId: string; eventId?: string; path: string };

const INBOX_INVITES_NOTIFICATION_ID = 1;

const getRoomNotificationId = (roomId: string): number => {
  let hash = 5381;
  for (let index = 0; index < roomId.length; index += 1) {
    hash = ((hash << 5) + hash + roomId.charCodeAt(index)) | 0;
  }
  return hash === INBOX_INVITES_NOTIFICATION_ID ? hash + 1 : hash;
};

const getNotificationId = (target: SystemNotificationTarget): number =>
  target.kind === 'inboxInvites'
    ? INBOX_INVITES_NOTIFICATION_ID
    : getRoomNotificationId(target.roomId);

const getTargetKey = (target: SystemNotificationTarget): string =>
  target.kind === 'inboxInvites' ? 'inboxInvites' : `room:${target.roomId}`;

const getPathForTarget = (target: SystemNotificationTarget): string =>
  target.kind === 'inboxInvites' ? getInboxInvitesPath() : target.path;

const checkIsNotificationTarget = (value: unknown): value is SystemNotificationTarget => {
  if (typeof value !== 'object' || value === null) return false;

  const { kind, roomId, path } = value as { kind?: unknown; roomId?: unknown; path?: unknown };
  if (kind === 'inboxInvites') return true;
  return kind === 'room' && typeof roomId === 'string' && typeof path === 'string';
};

const clickHandlers = new Set<(target: SystemNotificationTarget) => void>();

const emitClick = (target: SystemNotificationTarget): void => {
  clickHandlers.forEach((handleClick) => handleClick(target));
};

export const addSystemNotificationClickListener = (
  handleClick: (target: SystemNotificationTarget) => void
): (() => void) => {
  clickHandlers.add(handleClick);
  return () => {
    clickHandlers.delete(handleClick);
  };
};

let mobileClickListener: ReturnType<typeof addMobileNotificationClickListener> | undefined;
let isServiceWorkerClickListenerAdded = false;

export const prepareSystemNotifications = async (): Promise<void> => {
  if (checkIsNativeMobileApp()) {
    await prepareMobileNotifications();

    mobileClickListener ??= addMobileNotificationClickListener((extra) => {
      if (checkIsNotificationTarget(extra)) emitClick(extra);
    });
    await mobileClickListener;
    return;
  }

  if (isServiceWorkerClickListenerAdded || !navigator.serviceWorker) return;
  isServiceWorkerClickListenerAdded = true;

  navigator.serviceWorker.addEventListener('message', (event) => {
    if (event.data?.type !== 'durnible_notification_click') return;
    if (checkIsNotificationTarget(event.data.target)) emitClick(event.data.target);
  });
};

export const getSystemNotificationPermission = async (): Promise<PermissionState> => {
  if (checkIsNativeMobileApp()) return getMobileNotificationPermission();
  if (!('Notification' in window)) return 'denied';

  const { permission } = window.Notification;
  return permission === 'default' ? 'prompt' : permission;
};

export const requestSystemNotificationPermission = async (): Promise<PermissionState> => {
  if (checkIsNativeMobileApp()) return requestMobileNotificationPermission();
  if (!('Notification' in window)) return 'denied';

  const permission = await window.Notification.requestPermission();
  return permission === 'default' ? 'prompt' : permission;
};

const webNotificationByTargetKey = new Map<string, Notification>();

const showWebNotification = ({
  target,
  title,
  body,
  iconUrl,
}: {
  target: SystemNotificationTarget;
  title: string;
  body: string;
  iconUrl?: string;
}): void => {
  const targetKey = getTargetKey(target);
  const notification = new window.Notification(title, {
    icon: iconUrl,
    badge: iconUrl,
    body,
    silent: true,
  });

  notification.onclick = () => {
    if (!window.closed) emitClick(target);
    notification.close();
    webNotificationByTargetKey.delete(targetKey);
  };

  webNotificationByTargetKey.get(targetKey)?.close();
  webNotificationByTargetKey.set(targetKey, notification);
};

const showServiceWorkerNotification = async ({
  target,
  title,
  body,
  iconUrl,
}: {
  target: SystemNotificationTarget;
  title: string;
  body: string;
  iconUrl?: string;
}): Promise<void> => {
  const registration = await navigator.serviceWorker?.getRegistration();
  if (!registration) return;

  await registration.showNotification(title, {
    icon: iconUrl,
    badge: iconUrl,
    body,
    silent: true,
    tag: getTargetKey(target),
    data: { target, path: getPathForTarget(target) },
  });
};

export const showSystemNotification = async ({
  target,
  title,
  body,
  iconUrl,
}: {
  target: SystemNotificationTarget;
  title: string;
  body: string;
  iconUrl?: string;
}): Promise<void> => {
  if (checkIsNativeMobileApp() && document.visibilityState === 'visible') return;

  const permission = await getSystemNotificationPermission();
  if (permission !== 'granted') return;

  if (checkIsNativeMobileApp()) {
    await showMobileNotification({
      id: getNotificationId(target),
      title,
      body,
      extra: target,
    });
    return;
  }

  try {
    showWebNotification({ target, title, body, iconUrl });
  } catch {
    await showServiceWorkerNotification({ target, title, body, iconUrl });
  }
};
