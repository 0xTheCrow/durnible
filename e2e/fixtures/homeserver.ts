import type { BrowserContext, Page, Route } from '@playwright/test';

export const HOMESERVER_BASE_URL = 'https://matrix.test';
export const TEST_USER_ID = '@tester:matrix.test';
export const TEST_DEVICE_ID = 'TESTDEVICE';
export const TEST_ACCESS_TOKEN = 'syt_test_token';
export const TEST_ROOM_ID = '!room:matrix.test';
export const TEST_ROOM_NAME = 'Test Room';

export type SentEvent = {
  eventType: string;
  content: Record<string, unknown>;
};

const stateEvent = (
  type: string,
  stateKey: string,
  content: Record<string, unknown>
): Record<string, unknown> => ({
  type,
  state_key: stateKey,
  sender: TEST_USER_ID,
  content,
  event_id: `$state_${type}_${stateKey}`,
  origin_server_ts: 1700000000000,
});

const initialSync = (): Record<string, unknown> => ({
  next_batch: 's_1',
  device_one_time_keys_count: { signed_curve25519: 50 },
  account_data: { events: [] },
  presence: { events: [] },
  rooms: {
    join: {
      [TEST_ROOM_ID]: {
        summary: {},
        state: {
          events: [
            stateEvent('m.room.create', '', { creator: TEST_USER_ID, room_version: '10' }),
            stateEvent('m.room.member', TEST_USER_ID, {
              membership: 'join',
              displayname: 'Tester',
            }),
            stateEvent('m.room.power_levels', '', {
              users: { [TEST_USER_ID]: 100 },
              users_default: 0,
              events_default: 0,
              state_default: 50,
            }),
            stateEvent('m.room.name', '', { name: TEST_ROOM_NAME }),
            stateEvent('m.room.history_visibility', '', { history_visibility: 'shared' }),
          ],
        },
        timeline: {
          events: [
            {
              type: 'm.room.message',
              sender: TEST_USER_ID,
              content: { msgtype: 'm.text', body: 'first message' },
              event_id: '$first',
              origin_server_ts: 1700000000001,
            },
          ],
          prev_batch: 'p_0',
          limited: false,
        },
        ephemeral: { events: [] },
        account_data: { events: [] },
        unread_notifications: { notification_count: 0, highlight_count: 0 },
      },
    },
    invite: {},
    leave: {},
  },
});

const emptySync = (): Record<string, unknown> => ({
  next_batch: 's_1',
  account_data: { events: [] },
  presence: { events: [] },
  rooms: { join: {}, invite: {}, leave: {} },
});

const json = (route: Route, body: unknown, status = 200): Promise<void> =>
  route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });

/**
 * Seeds the four localStorage keys `getFallbackSession()` reads, so the app
 * boots straight into the client without going through the login screen.
 */
export const seedSession = (context: BrowserContext): Promise<void> =>
  context.addInitScript(
    ([baseUrl, userId, deviceId, accessToken]) => {
      localStorage.setItem('cinny_hs_base_url', baseUrl);
      localStorage.setItem('cinny_user_id', userId);
      localStorage.setItem('cinny_device_id', deviceId);
      localStorage.setItem('cinny_access_token', accessToken);
    },
    [HOMESERVER_BASE_URL, TEST_USER_ID, TEST_DEVICE_ID, TEST_ACCESS_TOKEN] as const
  );

export type HomeserverStub = {
  sentEvents: SentEvent[];
  unmatched: string[];
};

export const stubHomeserver = async (page: Page): Promise<HomeserverStub> => {
  const stub: HomeserverStub = { sentEvents: [], unmatched: [] };
  let syncCount = 0;

  await page.route(`${HOMESERVER_BASE_URL}/**`, async (route) => {
    const url = new URL(route.request().url());
    const { pathname } = url;

    if (pathname === '/_matrix/client/versions') {
      return json(route, {
        versions: ['v1.1', 'v1.5', 'v1.11'],
        unstable_features: {},
      });
    }

    if (pathname.endsWith('/sync')) {
      syncCount += 1;
      if (syncCount === 1) return json(route, initialSync());
      await new Promise((resolve) => {
        setTimeout(resolve, 30_000);
      });
      return json(route, emptySync());
    }

    if (pathname.includes('/send/')) {
      const eventType = pathname.split('/send/')[1].split('/')[0];
      stub.sentEvents.push({
        eventType,
        content: route.request().postDataJSON() as Record<string, unknown>,
      });
      return json(route, { event_id: `$sent_${stub.sentEvents.length}` });
    }

    if (pathname.endsWith('/messages')) {
      return json(route, { chunk: [], start: 'p_0' });
    }
    if (pathname.endsWith('/members')) {
      return json(route, {
        chunk: [stateEvent('m.room.member', TEST_USER_ID, { membership: 'join' })],
      });
    }
    if (pathname === '/_matrix/media/v3/config') {
      return json(route, { 'm.upload.size': 50_000_000 });
    }
    if (pathname.endsWith('/filter')) return json(route, { filter_id: '1' });
    if (pathname.endsWith('/capabilities')) return json(route, { capabilities: {} });
    if (pathname.includes('/pushrules')) {
      return json(route, {
        global: { content: [], override: [], room: [], sender: [], underride: [] },
      });
    }
    if (pathname.endsWith('/keys/upload')) {
      return json(route, { one_time_key_counts: { signed_curve25519: 50 } });
    }
    if (pathname.endsWith('/keys/query')) {
      return json(route, { device_keys: {}, master_keys: {}, self_signing_keys: {} });
    }
    if (pathname.endsWith('/keys/claim')) return json(route, { one_time_keys: {} });
    if (pathname.includes('/keys/changes')) return json(route, { changed: [], left: [] });
    if (pathname.includes('/profile/')) return json(route, { displayname: 'Tester' });
    if (pathname.endsWith('/joined_rooms')) return json(route, { joined_rooms: [TEST_ROOM_ID] });
    if (pathname.endsWith('/devices')) return json(route, { devices: [] });
    if (pathname.includes('/room_keys/version')) {
      return json(route, { errcode: 'M_NOT_FOUND' }, 404);
    }
    if (pathname.includes('/turnServer')) return json(route, {}, 404);

    stub.unmatched.push(`${route.request().method()} ${pathname}`);
    return json(route, {});
  });

  return stub;
};
