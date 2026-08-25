import type { BrowserContext, Page, Route } from '@playwright/test';
import {
  MATRIX_GALLERY_ID_PROPERTY_NAME,
  MATRIX_GALLERY_INDEX_PROPERTY_NAME,
} from '../../src/types/matrix/common';
import type { Settings } from '../../src/app/state/settings';
import { AccountDataEvent } from '../../src/types/matrix/accountData';

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

export const IMAGE_GALLERY_ID = 'gallery_grid';

export const imageEvent = (
  index: number,
  width: number,
  height: number
): Record<string, unknown> => ({
  type: 'm.room.message',
  sender: TEST_USER_ID,
  content: {
    msgtype: 'm.image',
    body: `image-${index}.png`,
    url: `mxc://matrix.test/image${index}`,
    info: { w: width, h: height, mimetype: 'image/png' },
    [MATRIX_GALLERY_ID_PROPERTY_NAME]: IMAGE_GALLERY_ID,
    [MATRIX_GALLERY_INDEX_PROPERTY_NAME]: index,
  },
  event_id: `$image${index}`,
  origin_server_ts: 1700000000002 + index,
});

export const AUDIO_DURATION_SECONDS = 0.5;

export const audioEvent = (
  mimeType = 'audio/wav',
  durationSeconds = AUDIO_DURATION_SECONDS
): Record<string, unknown> => ({
  type: 'm.room.message',
  sender: TEST_USER_ID,
  content: {
    msgtype: 'm.audio',
    body: 'voice-message',
    url: 'mxc://matrix.test/audioclip',
    info: {
      mimetype: mimeType,
      duration: durationSeconds * 1000,
    },
    'org.matrix.msc3245.voice': {},
  },
  event_id: '$audioclip',
  origin_server_ts: 1700000000003,
});

export const VIDEO_DURATION_SECONDS = 2;
export const VIDEO_WIDTH = 320;
export const VIDEO_HEIGHT = 240;

export const videoEvent = (
  mimeType = 'video/webm',
  durationSeconds = VIDEO_DURATION_SECONDS
): Record<string, unknown> => ({
  type: 'm.room.message',
  sender: TEST_USER_ID,
  content: {
    msgtype: 'm.video',
    body: 'video-clip',
    url: 'mxc://matrix.test/videoclip',
    info: {
      mimetype: mimeType,
      duration: durationSeconds * 1000,
      w: VIDEO_WIDTH,
      h: VIDEO_HEIGHT,
    },
  },
  event_id: '$videoclip',
  origin_server_ts: 1700000000004,
});

export const textEvent = (index: number): Record<string, unknown> => ({
  type: 'm.room.message',
  sender: TEST_USER_ID,
  content: { msgtype: 'm.text', body: `filler message ${index}` },
  event_id: `$filler${index}`,
  origin_server_ts: 1700000000010 + index,
});

export const historyEvent = (index: number): Record<string, unknown> => ({
  type: 'm.room.message',
  sender: TEST_USER_ID,
  content: { msgtype: 'm.text', body: `history message ${index}` },
  event_id: `$history${index}`,
  origin_server_ts: 1699999990000 + index,
});

export const replyEvent = (index: number, repliedToEventId: string): Record<string, unknown> => ({
  type: 'm.room.message',
  sender: TEST_USER_ID,
  content: {
    msgtype: 'm.text',
    body: `> replied\n\nreply message ${index}`,
    'm.relates_to': { 'm.in_reply_to': { event_id: repliedToEventId } },
  },
  event_id: `$reply${index}`,
  origin_server_ts: 1700000000010 + index,
});

export const TEST_CUSTOM_EMOJI_SHORTCODE = 'durnibletestemoji';
export const TEST_CUSTOM_EMOJI_MXC = 'mxc://matrix.test/customemoji';

const userImagePackEvent = (): Record<string, unknown> => ({
  type: AccountDataEvent.PoniesUserEmotes,
  content: {
    pack: { display_name: 'Test Pack', usage: ['emoticon'] },
    images: { [TEST_CUSTOM_EMOJI_SHORTCODE]: { url: TEST_CUSTOM_EMOJI_MXC } },
  },
});

const initialSync = ({
  timelineEvents = [],
  userImagePack = false,
}: StubHomeserverOptions): Record<string, unknown> => ({
  next_batch: 's_1',
  device_one_time_keys_count: { signed_curve25519: 50 },
  account_data: { events: userImagePack ? [userImagePackEvent()] : [] },
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
            ...timelineEvents,
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

export const liveMessageEvent = (id: string, body: string): Record<string, unknown> => ({
  type: 'm.room.message',
  sender: TEST_USER_ID,
  content: { msgtype: 'm.text', body },
  event_id: id,
  origin_server_ts: 1700000100000,
});

export const reactionEvent = (
  id: string,
  reactsToEventId: string,
  key: string
): Record<string, unknown> => ({
  type: 'm.reaction',
  sender: TEST_USER_ID,
  content: { 'm.relates_to': { rel_type: 'm.annotation', event_id: reactsToEventId, key } },
  event_id: id,
  origin_server_ts: 1700000100000,
});

const liveSync = (
  batch: number,
  events: Record<string, unknown>[],
  isLimited: boolean
): Record<string, unknown> => ({
  next_batch: `s_${batch}`,
  account_data: { events: [] },
  presence: { events: [] },
  rooms: {
    join: {
      [TEST_ROOM_ID]: {
        summary: {},
        state: { events: [] },
        timeline: { events, prev_batch: `p_${batch}`, limited: isLimited },
        ephemeral: { events: [] },
        account_data: { events: [] },
        unread_notifications: { notification_count: 0, highlight_count: 0 },
      },
    },
    invite: {},
    leave: {},
  },
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

export const RICH_TEXT_EDITOR_SETTINGS: Partial<Settings> = {
  editorToolbar: true,
};

export const seedSettings = (page: Page, settings: Partial<Settings>): Promise<void> =>
  page.addInitScript((serializedSettings) => {
    localStorage.setItem('settings', serializedSettings);
  }, JSON.stringify(settings));

export type PushTimelineOptions = {
  isLimited?: boolean;
};

export type HomeserverStub = {
  sentEvents: SentEvent[];
  unmatched: string[];
  pushTimeline: (events: Record<string, unknown>[], options?: PushTimelineOptions) => void;
  historyRequested: Promise<void>;
};

const SYNC_LONG_POLL_MS = 30_000;

export type StubHomeserverOptions = {
  timelineEvents?: Record<string, unknown>[];
  echoSentEvents?: boolean;
  userImagePack?: boolean;
  audioResponse?: { body: Buffer; contentType: string };
  videoResponse?: { body: Buffer; contentType: string };
  historyEvents?: Record<string, unknown>[];
  historyDelayMs?: number;
};

const TRANSPARENT_PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
  'base64'
);

const silentWav = (durationSeconds: number): Buffer => {
  const sampleRate = 8000;
  const sampleCount = Math.floor(sampleRate * durationSeconds);
  const wav = Buffer.alloc(44 + sampleCount);
  wav.write('RIFF', 0);
  wav.writeUInt32LE(36 + sampleCount, 4);
  wav.write('WAVE', 8);
  wav.write('fmt ', 12);
  wav.writeUInt32LE(16, 16);
  wav.writeUInt16LE(1, 20);
  wav.writeUInt16LE(1, 22);
  wav.writeUInt32LE(sampleRate, 24);
  wav.writeUInt32LE(sampleRate, 28);
  wav.writeUInt16LE(1, 32);
  wav.writeUInt16LE(8, 34);
  wav.write('data', 36);
  wav.writeUInt32LE(sampleCount, 40);
  wav.fill(128, 44);
  return wav;
};

const SILENT_WAV = silentWav(AUDIO_DURATION_SECONDS);

export const stubHomeserver = async (
  page: Page,
  options: StubHomeserverOptions = {}
): Promise<HomeserverStub> => {
  const queuedSyncs: Record<string, unknown>[] = [];
  const liveEventLog: Record<string, unknown>[] = [];
  let releaseLongPoll: (() => void) | undefined;
  let resolveHistoryRequested: (() => void) | undefined;
  const stub: HomeserverStub = {
    sentEvents: [],
    unmatched: [],
    pushTimeline: (events, { isLimited = false } = {}) => {
      queuedSyncs.push(liveSync(queuedSyncs.length + 2, events, isLimited));
      liveEventLog.push(...events);
      releaseLongPoll?.();
    },
    historyRequested: new Promise((resolve) => {
      resolveHistoryRequested = resolve;
    }),
  };
  let syncCount = 0;
  let historyServed = false;

  const takeQueuedSync = (): Promise<Record<string, unknown> | undefined> =>
    new Promise((resolve) => {
      const settle = () => {
        clearTimeout(timeoutId);
        releaseLongPoll = undefined;
        resolve(queuedSyncs.shift());
      };
      const timeoutId = setTimeout(settle, SYNC_LONG_POLL_MS);
      if (queuedSyncs.length > 0) {
        settle();
        return;
      }
      releaseLongPoll = settle;
    });

  await page.route(`${HOMESERVER_BASE_URL}/**`, async (route) => {
    const url = new URL(route.request().url());
    const { pathname } = url;

    if (pathname === '/.well-known/matrix/client') {
      return json(route, { 'm.homeserver': { base_url: HOMESERVER_BASE_URL } });
    }

    if (pathname === '/_matrix/client/versions') {
      return json(route, {
        versions: ['v1.1', 'v1.5', 'v1.11'],
        unstable_features: {},
      });
    }

    if (pathname.endsWith('/sync')) {
      syncCount += 1;
      if (syncCount === 1) return json(route, initialSync(options));
      const queued = await takeQueuedSync();
      return json(route, queued ?? emptySync());
    }

    if (pathname.includes('/send/')) {
      const [eventType, transactionId] = pathname.split('/send/')[1].split('/');
      const content = route.request().postDataJSON() as Record<string, unknown>;
      stub.sentEvents.push({ eventType, content });
      const eventId = `$sent_${stub.sentEvents.length}`;
      if (options.echoSentEvents) {
        stub.pushTimeline([
          {
            type: eventType,
            sender: TEST_USER_ID,
            content,
            event_id: eventId,
            origin_server_ts: 1700000200000 + stub.sentEvents.length,
            unsigned: { transaction_id: transactionId },
          },
        ]);
      }
      return json(route, { event_id: eventId });
    }

    if (pathname.endsWith('/messages')) {
      const isBackwards = url.searchParams.get('dir') === 'b';
      if (isBackwards && options.historyEvents?.length && !historyServed) {
        historyServed = true;
        resolveHistoryRequested?.();
        if (options.historyDelayMs) {
          await new Promise<void>((resolve) => {
            setTimeout(resolve, options.historyDelayMs);
          });
        }
        return json(route, { chunk: [...options.historyEvents].reverse(), start: 'p_0' });
      }
      if (!isBackwards && liveEventLog.length > 0) {
        return json(route, { chunk: [...liveEventLog], start: 'p_0', end: 'p_forward' });
      }
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
    if (pathname.includes('/media/')) {
      if (pathname.includes('videoclip')) {
        if (!options.videoResponse) return json(route, { errcode: 'M_NOT_FOUND' }, 404);
        const { body, contentType } = options.videoResponse;
        return route.fulfill({ status: 200, contentType, body });
      }
      if (pathname.includes('audioclip')) {
        const { body, contentType } = options.audioResponse ?? {
          body: SILENT_WAV,
          contentType: 'audio/wav',
        };
        return route.fulfill({ status: 200, contentType, body });
      }
      return route.fulfill({ status: 200, contentType: 'image/png', body: TRANSPARENT_PNG });
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
