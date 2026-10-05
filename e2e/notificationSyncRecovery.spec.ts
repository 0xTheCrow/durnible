import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';
import {
  seedSession,
  seedSettings,
  stubHomeserver,
  liveMessageEvent,
  TEST_ROOM_NAME,
} from './fixtures/homeserver';
import type { Settings } from '../src/app/state/settings';

const OTHER_USER_ID = '@friend:matrix.test';

const BOOT_TIMEOUT_MS = 20000;
const RECONNECT_TIMEOUT_MS = 30000;

type RecordedNotification = { title: string; body?: string };

const recordWebNotifications = (page: Page): Promise<void> =>
  page.addInitScript(() => {
    const notificationLog: RecordedNotification[] = [];

    class RecordingNotification {
      static permission = 'granted';

      static requestPermission = async () => 'granted';

      onclick: (() => void) | null = null;

      constructor(title: string, options?: { body?: string }) {
        notificationLog.push({ title, body: options?.body });
      }

      close() {
        this.onclick = null;
      }
    }

    Object.defineProperty(window, 'Notification', {
      value: RecordingNotification,
      configurable: true,
    });
    Object.defineProperty(window, '__notificationLog', {
      value: notificationLog,
      configurable: true,
    });
  });

const readNotificationLog = (page: Page): Promise<RecordedNotification[]> =>
  page.evaluate(
    () => (window as unknown as { __notificationLog: RecordedNotification[] }).__notificationLog
  );

const waitForNotificationCount = (page: Page, count: number, timeout: number): Promise<unknown> =>
  page.waitForFunction(
    (expected) =>
      (window as unknown as { __notificationLog: RecordedNotification[] }).__notificationLog
        .length >= expected,
    count,
    { timeout }
  );

test('notifies for messages delivered in the first sync batch after a reconnect', async ({
  page,
  context,
}) => {
  await seedSession(context);
  await seedSettings(page, {
    showNotifications: true,
    isNotificationSoundEnabled: false,
  } satisfies Partial<Settings>);
  await recordWebNotifications(page);
  const stub = await stubHomeserver(page);

  await page.goto('/home');

  stub.pushTimeline([liveMessageEvent('$steady', 'steady state message', OTHER_USER_ID)], {
    notificationCount: 1,
  });
  await waitForNotificationCount(page, 1, BOOT_TIMEOUT_MS);

  stub.failPendingSync();

  stub.pushTimeline([liveMessageEvent('$catchup', 'catch up message', OTHER_USER_ID)], {
    notificationCount: 2,
  });
  await waitForNotificationCount(page, 2, RECONNECT_TIMEOUT_MS);

  const notificationLog = await readNotificationLog(page);
  expect(notificationLog).toHaveLength(2);
  expect(notificationLog[1].title).toBe(TEST_ROOM_NAME);
});
