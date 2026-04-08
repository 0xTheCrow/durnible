import { vi } from 'vitest';
import { EventTimeline, MatrixClient, MatrixEvent, Room, RoomMember } from 'matrix-js-sdk';

let eventCounter = 0;

type MockEventOptions = {
  id?: string;
  sender?: string;
  type?: string;
  stateKey?: string;
  ts?: number;
  content?: Record<string, unknown>;
  unsigned?: Record<string, unknown>;
  redacted?: boolean;
  roomId?: string;
};

export function createMockMatrixEvent(opts: MockEventOptions = {}): MatrixEvent {
  const id = opts.id ?? `$event${++eventCounter}`;
  const sender = opts.sender ?? '@alice:example.com';
  const type = opts.type ?? 'm.room.message';
  const ts = opts.ts ?? Date.now();
  const content = opts.content ?? { body: 'hello', msgtype: 'm.text' };
  const roomId = opts.roomId ?? '!room:example.com';

  return {
    getId: vi.fn(() => id),
    getSender: vi.fn(() => sender),
    getType: vi.fn(() => type),
    getStateKey: vi.fn(() => opts.stateKey),
    getTs: vi.fn(() => ts),
    getContent: vi.fn(() => content),
    getUnsigned: vi.fn(() => opts.unsigned ?? {}),
    getWireContent: vi.fn(() => content),
    getPrevContent: vi.fn(() => ({})),
    isRedacted: vi.fn(() => opts.redacted ?? false),
    isRelation: vi.fn(() => false),
    isEncrypted: vi.fn(() => false),
    getRoomId: vi.fn(() => roomId),
    getEffectiveEvent: vi.fn(() => ({ type, content, sender, event_id: id })),
    replyEventId: undefined,
    threadRootId: undefined,
    event: { type, content, sender, event_id: id },
  } as unknown as MatrixEvent;
}

export function createMockTextEvent(body: string, sender?: string): MatrixEvent {
  return createMockMatrixEvent({
    sender,
    content: {
      body,
      msgtype: 'm.text',
    },
  });
}

export function createMockImageEvent(
  body: string,
  url: string,
  opts?: { sender?: string; width?: number; height?: number; size?: number; mimetype?: string }
): MatrixEvent {
  return createMockMatrixEvent({
    sender: opts?.sender,
    content: {
      body,
      msgtype: 'm.image',
      url,
      info: {
        w: opts?.width ?? 800,
        h: opts?.height ?? 600,
        size: opts?.size ?? 50000,
        mimetype: opts?.mimetype ?? 'image/png',
      },
    },
  });
}

export function createMockEmoteEvent(body: string, sender?: string): MatrixEvent {
  return createMockMatrixEvent({
    sender,
    content: {
      body,
      msgtype: 'm.emote',
    },
  });
}

export function createMockRoomMember(
  userId: string,
  displayName?: string,
  avatarUrl?: string
): Partial<RoomMember> {
  return {
    userId,
    name: displayName ?? userId,
    rawDisplayName: displayName ?? userId,
    getMxcAvatarUrl: vi.fn(() => avatarUrl),
    getAvatarUrl: vi.fn(() => avatarUrl ?? null) as unknown as RoomMember['getAvatarUrl'],
  };
}

function createMockTimelineState() {
  return {
    getStateEvents: vi.fn(() => null),
  };
}

function createMockTimeline() {
  const state = createMockTimelineState();
  return {
    getEvents: vi.fn(() => []),
    getState: vi.fn(() => state),
    getRoomId: vi.fn(() => '!room:example.com'),
    getPaginationToken: vi.fn(() => null),
    getNeighbouringTimeline: vi.fn(() => null),
    getTimelineSet: vi.fn(() => ({})),
  };
}

export type MockRoom = Partial<Room> & {
  _addMockMember: (userId: string, displayName?: string, avatarUrl?: string) => void;
};

export function createMockRoom(
  roomId?: string,
  mx?: Partial<MatrixClient>
): MockRoom {
  const id = roomId ?? '!room:example.com';
  const members = new Map<string, Partial<RoomMember>>();
  const timeline = createMockTimeline();

  const room: Record<string, unknown> = {
    roomId: id,
    client: mx ?? createMockMatrixClient(),
    getMember: vi.fn((userId: string) => (members.get(userId) as RoomMember) ?? null),
    getCanonicalAlias: vi.fn(() => null),
    getAltAliases: vi.fn(() => []),
    hasEncryptionStateEvent: vi.fn(() => false),
    findEventById: vi.fn(() => undefined),
    getEventReadUpTo: vi.fn(() => undefined),
    getLiveTimeline: vi.fn(() => timeline),
    getUnfilteredTimelineSet: vi.fn(() => ({
      getLiveTimeline: vi.fn(() => timeline),
      findEventById: vi.fn(() => undefined),
    })),
    on: vi.fn().mockReturnThis(),
    off: vi.fn().mockReturnThis(),
    removeListener: vi.fn().mockReturnThis(),
    getTimelineForEvent: vi.fn(() => undefined),
    _addMockMember: (userId: string, displayName?: string, avatarUrl?: string) => {
      members.set(userId, createMockRoomMember(userId, displayName, avatarUrl));
    },
  };

  return room as unknown as MockRoom;
}

export function createMockMatrixClient(): Partial<MatrixClient> {
  return {
    getUserId: vi.fn(() => '@me:example.com'),
    getSafeUserId: vi.fn(() => '@me:example.com'),
    getHomeserverUrl: vi.fn(() => 'https://example.com'),
    mxcUrlToHttp: vi.fn(
      (mxcUrl: string) => `https://example.com/_matrix/media/v3/download/${mxcUrl.slice(6)}`
    ),
    getRoom: vi.fn(() => null),
    getAccountData: vi.fn(() => undefined),
    sendEvent: vi.fn(async () => ({ event_id: '$sent' })),
    sendMessage: vi.fn(async () => ({ event_id: '$sent' })) as unknown as MatrixClient['sendMessage'],
    redactEvent: vi.fn(async () => ({ event_id: '$redacted' })) as unknown as MatrixClient['redactEvent'],
    on: vi.fn().mockReturnThis(),
    off: vi.fn().mockReturnThis(),
    removeListener: vi.fn().mockReturnThis(),
  };
}
