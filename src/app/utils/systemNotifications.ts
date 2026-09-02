import { getInboxInvitesPath, getInboxNotificationsPath } from '../pages/pathUtils';
import { checkIsNativeMobileApp } from '../platform/mobile';
import {
  addMobileNotificationClickListener,
  getMobileNotificationPermission,
  prepareMobileNotifications,
  requestMobileNotificationPermission,
  showMobileNotification,
} from '../platform/mobile/notifications';

export type SystemNotificationTarget = 'inboxInvites' | 'inboxNotifications';

const NOTIFICATION_ID_BY_TARGET: Record<SystemNotificationTarget, number> = {
  inboxInvites: 1,
  inboxNotifications: 2,
};

const getPathForTarget = (target: SystemNotificationTarget): string =>
  target === 'inboxInvites' ? getInboxInvitesPath() : getInboxNotificationsPath();

const TARGET_BY_NOTIFICATION_ID = new Map<number, SystemNotificationTarget>(
  Object.entries(NOTIFICATION_ID_BY_TARGET).map(([target, id]) => [
    id,
    target as SystemNotificationTarget,
  ])
);

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

const checkIsNotificationTarget = (value: unknown): value is SystemNotificationTarget =>
  value === 'inboxInvites' || value === 'inboxNotifications';

export const prepareSystemNotifications = async (): Promise<void> => {
  if (checkIsNativeMobileApp()) {
    await prepareMobileNotifications();

    mobileClickListener ??= addMobileNotificationClickListener((id) => {
      const target = TARGET_BY_NOTIFICATION_ID.get(id);
      if (target) emitClick(target);
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

const webNotificationByTarget = new Map<SystemNotificationTarget, Notification>();

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
  const notification = new window.Notification(title, {
    icon: iconUrl,
    badge: iconUrl,
    body,
    silent: true,
  });

  notification.onclick = () => {
    if (!window.closed) emitClick(target);
    notification.close();
    webNotificationByTarget.delete(target);
  };

  webNotificationByTarget.get(target)?.close();
  webNotificationByTarget.set(target, notification);
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
    tag: target,
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
  const permission = await getSystemNotificationPermission();
  if (permission !== 'granted') return;

  if (checkIsNativeMobileApp()) {
    await showMobileNotification({
      id: NOTIFICATION_ID_BY_TARGET[target],
      title,
      body,
    });
    return;
  }

  try {
    showWebNotification({ target, title, body, iconUrl });
  } catch {
    await showServiceWorkerNotification({ target, title, body, iconUrl });
  }
};
