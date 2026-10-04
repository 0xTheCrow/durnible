import { randomUUID } from 'node:crypto';
import type { Page, Route } from '@playwright/test';
import { EventType } from 'matrix-js-sdk/lib/@types/event.js';
import { RoomType, StateEvent } from '../../src/types/matrix/room';
import { RTC_FOCI_WELL_KNOWN_KEY } from '../../src/app/plugins/call/sfu';
import type { TestSession } from './homeserver';
import { HOMESERVER_BASE_URL, fulfillUserIndependentRequest, json, stateEvent } from './homeserver';
import { LIVEKIT_URL, createLivekitToken } from './livekitServer';

export const LIVEKIT_SERVICE_URL = 'https://livekit-jwt.test';
export const CALL_MEMBER_EVENT_TYPE = EventType.GroupCallMemberPrefix;

const SERVER_NAME = 'matrix.test';
const SYNC_LONG_POLL_MS = 30_000;
const DELAYED_EVENT_QUERY_PARAMETER = 'org.matrix.msc4140.delay';

export type CallTestUser = TestSession & { displayName: string };

export const CALL_TEST_USERS: { alice: CallTestUser; bob: CallTestUser } = {
  alice: {
    userId: `@alice:${SERVER_NAME}`,
    deviceId: 'ALICEDEVICE',
    accessToken: 'syt_alice_token',
    displayName: 'Alice',
  },
  bob: {
    userId: `@bob:${SERVER_NAME}`,
    deviceId: 'BOBDEVICE',
    accessToken: 'syt_bob_token',
    displayName: 'Bob',
  },
};

export type SentStateEvent = {
  roomId: string;
  sender: string;
  eventType: string;
  stateKey: string;
  content: Record<string, unknown>;
};

type MatrixEventJson = Record<string, unknown>;

type ClientConnection = {
  user: CallTestUser;
  takeSync: () => Promise<Record<string, unknown>>;
  deliver: (roomId: string, event: MatrixEventJson) => void;
  close: () => void;
};

export type CallHomeserver = {
  spaceId: string;
  voiceRoomIds: [string, string];
  homeRoomId: string;
  sentStateEvents: SentStateEvent[];
  unmatched: string[];
  setIsSfuServiceAvailable: (isAvailable: boolean) => void;
  attach: (page: Page, user: CallTestUser) => Promise<void>;
};

const getStateMapKey = (eventType: string, stateKey: string): string => `${eventType}|${stateKey}`;

const decodePathSegments = (pathname: string): string[] =>
  pathname.split('/').map((segment) => decodeURIComponent(segment));

const buildJoinedRoom = (state: MatrixEventJson[], timeline: MatrixEventJson[], batch: number) => ({
  summary: {},
  state: { events: state },
  timeline: { events: timeline, prev_batch: `p_${batch}`, limited: false },
  ephemeral: { events: [] },
  account_data: { events: [] },
  unread_notifications: { notification_count: 0, highlight_count: 0 },
});

const buildSync = (batch: number, joinedRooms: Record<string, unknown>) => ({
  next_batch: `s_${batch}`,
  device_one_time_keys_count: { signed_curve25519: 50 },
  account_data: { events: [] },
  presence: { events: [] },
  rooms: { join: joinedRooms, invite: {}, leave: {} },
});

/**
 * One in-memory server shared by every page attached to it: a space holding two voice
 * rooms, plus a text room outside the space, both test users joined to all four. State and
 * timeline events a page sends are relayed unchanged to every attached page's next sync, so call memberships seen by one
 * client are exactly what the other client's SDK produced.
 */
export const createCallHomeserver = (): CallHomeserver => {
  const roomSuffix = randomUUID().slice(0, 8);
  const spaceId = `!space-${roomSuffix}:${SERVER_NAME}`;
  const voiceRoomIds: [string, string] = [
    `!voice-one-${roomSuffix}:${SERVER_NAME}`,
    `!voice-two-${roomSuffix}:${SERVER_NAME}`,
  ];
  const homeRoomId = `!home-${roomSuffix}:${SERVER_NAME}`;
  const users = Object.values(CALL_TEST_USERS);
  const roomStateById = new Map<string, Map<string, MatrixEventJson>>();
  const connections = new Set<ClientConnection>();
  const sentStateEvents: SentStateEvent[] = [];
  const unmatched: string[] = [];
  let isSfuServiceAvailable = true;
  let eventCount = 0;

  const setRoomState = (roomId: string, event: MatrixEventJson) => {
    const roomState = roomStateById.get(roomId) ?? new Map<string, MatrixEventJson>();
    roomState.set(getStateMapKey(String(event.type), String(event.state_key)), event);
    roomStateById.set(roomId, roomState);
  };

  const createSharedRoomState = (roomId: string, name: string, roomType?: RoomType) => {
    const creator = users[0].userId;
    setRoomState(
      roomId,
      stateEvent(
        StateEvent.RoomCreate,
        '',
        roomType ? { creator, type: roomType } : { creator },
        creator
      )
    );
    setRoomState(roomId, stateEvent(StateEvent.RoomName, '', { name }, creator));
    setRoomState(
      roomId,
      stateEvent(
        StateEvent.RoomPowerLevels,
        '',
        {
          users: Object.fromEntries(users.map((user) => [user.userId, 100])),
          users_default: 0,
          events_default: 0,
          state_default: 50,
        },
        creator
      )
    );
    users.forEach((user) =>
      setRoomState(
        roomId,
        stateEvent(
          StateEvent.RoomMember,
          user.userId,
          { membership: 'join', displayname: user.displayName },
          user.userId
        )
      )
    );
  };

  createSharedRoomState(spaceId, 'Call Space', RoomType.Space);
  voiceRoomIds.forEach((voiceRoomId, index) => {
    createSharedRoomState(voiceRoomId, `Voice ${index + 1}`, RoomType.Call);
    setRoomState(
      spaceId,
      stateEvent(StateEvent.SpaceChild, voiceRoomId, { via: [SERVER_NAME] }, users[0].userId)
    );
  });
  createSharedRoomState(homeRoomId, 'Lounge');

  const createClientConnection = (user: CallTestUser): ClientConnection => {
    let syncCount = 0;
    let releaseLongPoll: (() => void) | undefined;
    const pendingTimelineByRoomId = new Map<string, MatrixEventJson[]>();

    const buildInitialSync = () =>
      buildSync(
        syncCount,
        Object.fromEntries(
          [...roomStateById.entries()].map(([roomId, roomState]) => [
            roomId,
            buildJoinedRoom([...roomState.values()], [], syncCount),
          ])
        )
      );

    const buildPendingSync = () => {
      const pendingRooms = [...pendingTimelineByRoomId.entries()];
      pendingTimelineByRoomId.clear();
      return buildSync(
        syncCount,
        Object.fromEntries(
          pendingRooms.map(([roomId, events]) => [roomId, buildJoinedRoom([], events, syncCount)])
        )
      );
    };

    const waitForPendingSync = () =>
      new Promise<Record<string, unknown>>((resolve) => {
        const settle = () => {
          clearTimeout(timeoutId);
          releaseLongPoll = undefined;
          resolve(buildPendingSync());
        };
        const timeoutId = setTimeout(settle, SYNC_LONG_POLL_MS);
        if (pendingTimelineByRoomId.size > 0) {
          settle();
          return;
        }
        releaseLongPoll = settle;
      });

    return {
      user,
      takeSync: async () => {
        syncCount += 1;
        if (syncCount === 1) return buildInitialSync();
        return waitForPendingSync();
      },
      deliver: (roomId, event) => {
        const pendingEvents = pendingTimelineByRoomId.get(roomId) ?? [];
        pendingEvents.push(event);
        pendingTimelineByRoomId.set(roomId, pendingEvents);
        releaseLongPoll?.();
      },
      close: () => releaseLongPoll?.(),
    };
  };

  const publishEvent = (
    roomId: string,
    event: MatrixEventJson,
    senderTransactionId?: string
  ): void => {
    if (typeof event.state_key === 'string') setRoomState(roomId, event);
    connections.forEach((connection) => {
      const isSender = connection.user.userId === event.sender;
      connection.deliver(
        roomId,
        isSender && senderTransactionId
          ? { ...event, unsigned: { transaction_id: senderTransactionId } }
          : event
      );
    });
  };

  const createEvent = (
    sender: string,
    eventType: string,
    content: Record<string, unknown>,
    stateKey?: string
  ): MatrixEventJson => {
    eventCount += 1;
    return {
      type: eventType,
      sender,
      content,
      event_id: `$call_event_${eventCount}`,
      origin_server_ts: Date.now(),
      ...(stateKey === undefined ? {} : { state_key: stateKey }),
    };
  };

  const buildHierarchyRoom = (roomId: string) => {
    const roomState = [...(roomStateById.get(roomId)?.values() ?? [])];
    const findContent = (eventType: string) =>
      roomState.find((event) => event.type === eventType)?.content as
        | Record<string, unknown>
        | undefined;
    return {
      room_id: roomId,
      name: findContent(StateEvent.RoomName)?.name,
      room_type: findContent(StateEvent.RoomCreate)?.type,
      num_joined_members: users.length,
      world_readable: false,
      guest_can_join: false,
      children_state: roomState
        .filter((event) => event.type === StateEvent.SpaceChild)
        .map(({ type, state_key: stateKey, content, sender, origin_server_ts: timestamp }) => ({
          type,
          state_key: stateKey,
          content,
          sender,
          origin_server_ts: timestamp,
        })),
    };
  };

  const respondToSfuService = async (route: Route, user: CallTestUser): Promise<void> => {
    const { pathname } = new URL(route.request().url());
    if (pathname !== '/sfu/get') {
      unmatched.push(`${route.request().method()} ${LIVEKIT_SERVICE_URL}${pathname}`);
      await json(route, {}, 404);
      return;
    }
    if (!isSfuServiceAvailable) {
      await json(route, { errcode: 'M_UNKNOWN' }, 500);
      return;
    }
    const requestBody = route.request().postDataJSON() as { room: string; device_id: string };
    const jwt = createLivekitToken(`${user.userId}:${requestBody.device_id}`, requestBody.room);
    await json(route, { url: LIVEKIT_URL, jwt });
  };

  const respondToRoomRequest = async (
    route: Route,
    user: CallTestUser,
    pathSegments: string[]
  ): Promise<boolean> => {
    const request = route.request();
    const roomsIndex = pathSegments.indexOf('rooms');
    if (roomsIndex < 0) return false;
    const roomId = pathSegments[roomsIndex + 1];
    const roomAction = pathSegments[roomsIndex + 2];
    const method = request.method();

    if (roomAction === 'state' && method === 'PUT') {
      if (new URL(request.url()).searchParams.has(DELAYED_EVENT_QUERY_PARAMETER)) {
        await json(route, { errcode: 'M_UNRECOGNIZED' }, 400);
        return true;
      }
      const eventType = pathSegments[roomsIndex + 3];
      const stateKey = pathSegments[roomsIndex + 4] ?? '';
      const content = request.postDataJSON() as Record<string, unknown>;
      sentStateEvents.push({ roomId, sender: user.userId, eventType, stateKey, content });
      const event = createEvent(user.userId, eventType, content, stateKey);
      publishEvent(roomId, event);
      await json(route, { event_id: event.event_id });
      return true;
    }
    if (roomAction === 'send' && method === 'PUT') {
      const eventType = pathSegments[roomsIndex + 3];
      const transactionId = pathSegments[roomsIndex + 4];
      const content = request.postDataJSON() as Record<string, unknown>;
      const event = createEvent(user.userId, eventType, content);
      publishEvent(roomId, event, transactionId);
      await json(route, { event_id: event.event_id });
      return true;
    }
    if (roomAction === 'state' && method === 'GET') {
      await json(route, [...(roomStateById.get(roomId)?.values() ?? [])]);
      return true;
    }
    if (roomAction === 'members') {
      const memberEvents = [...(roomStateById.get(roomId)?.values() ?? [])].filter(
        (event) => event.type === StateEvent.RoomMember
      );
      await json(route, { chunk: memberEvents });
      return true;
    }
    if (roomAction === 'messages') {
      await json(route, { chunk: [], start: 'p_0' });
      return true;
    }
    if (roomAction === 'hierarchy') {
      await json(route, { rooms: [...roomStateById.keys()].map(buildHierarchyRoom) });
      return true;
    }
    return false;
  };

  const respondToHomeserver = async (route: Route, connection: ClientConnection): Promise<void> => {
    const request = route.request();
    const { pathname } = new URL(request.url());
    const pathSegments = decodePathSegments(pathname);
    const { user } = connection;

    if (pathname === '/.well-known/matrix/client') {
      await json(route, {
        'm.homeserver': { base_url: HOMESERVER_BASE_URL },
        [RTC_FOCI_WELL_KNOWN_KEY]: [{ type: 'livekit', livekit_service_url: LIVEKIT_SERVICE_URL }],
      });
      return;
    }
    if (pathname === '/_matrix/client/versions') {
      await json(route, { versions: ['v1.1', 'v1.5', 'v1.11'], unstable_features: {} });
      return;
    }
    if (pathname.endsWith('/sync')) {
      await json(route, await connection.takeSync());
      return;
    }
    if (await respondToRoomRequest(route, user, pathSegments)) return;
    if (pathname.endsWith('/openid/request_token')) {
      await json(route, {
        access_token: `openid_${user.deviceId}`,
        token_type: 'Bearer',
        matrix_server_name: SERVER_NAME,
        expires_in: 3600,
      });
      return;
    }
    if (pathname.includes('/sendToDevice/')) {
      await json(route, {});
      return;
    }
    if (pathname.includes('/profile/')) {
      const profileUserId = pathSegments[pathSegments.indexOf('profile') + 1];
      const profileUser = users.find((candidate) => candidate.userId === profileUserId);
      await json(route, { displayname: profileUser?.displayName ?? profileUserId });
      return;
    }
    if (pathname.endsWith('/joined_rooms')) {
      await json(route, { joined_rooms: [...roomStateById.keys()] });
      return;
    }
    if (pathname === '/_matrix/media/v3/config') {
      await json(route, { 'm.upload.size': 50_000_000 });
      return;
    }
    if (await fulfillUserIndependentRequest(route, pathname)) return;

    unmatched.push(`${request.method()} ${pathname}`);
    await json(route, {});
  };

  return {
    spaceId,
    voiceRoomIds,
    homeRoomId,
    sentStateEvents,
    unmatched,
    setIsSfuServiceAvailable: (isAvailable) => {
      isSfuServiceAvailable = isAvailable;
    },
    attach: async (page, user) => {
      const connection = createClientConnection(user);
      connections.add(connection);
      page.on('close', () => {
        connection.close();
        connections.delete(connection);
      });
      await page.route(`${HOMESERVER_BASE_URL}/**`, (route) =>
        respondToHomeserver(route, connection)
      );
      await page.route(`${LIVEKIT_SERVICE_URL}/**`, (route) => respondToSfuService(route, user));
    },
  };
};
