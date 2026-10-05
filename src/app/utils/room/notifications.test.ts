import { describe, it, expect, vi } from 'vitest';
import type { MatrixClient, MatrixEvent, Room } from 'matrix-js-sdk';
import { EventType } from 'matrix-js-sdk';
import { createMockMatrixClient, createMockMatrixEvent, createMockRoom } from '../../../test/mocks';
import { NOTIFICATION_EVENT_TYPES, checkIsEventEligibleForNotification } from './notifications';

const SELF_USER_ID = '@me:example.com';
const OTHER_USER_ID = '@alice:example.com';

const [NOTIFYING_EVENT_TYPE] = NOTIFICATION_EVENT_TYPES.filter(
  (eventType) => eventType !== EventType.RoomMember
);

const READ_RECEIPT_TS = 2000;
const EVENT_TS_BEFORE_RECEIPT = READ_RECEIPT_TS - 1000;

const makeClient = (): MatrixClient => {
  const client = createMockMatrixClient() as Record<string, unknown>;
  client.getUserId = vi.fn(() => SELF_USER_ID);
  client.getRoomPushRule = vi.fn(() => undefined);
  client.getAccountData = vi.fn(() => undefined);
  return client as unknown as MatrixClient;
};

const makeRoom = ({
  readReceiptTs = 0,
  liveEvents = [],
}: { readReceiptTs?: number; liveEvents?: MatrixEvent[] } = {}): Room => {
  const room = createMockRoom() as unknown as Record<string, unknown>;
  room.isSpaceRoom = vi.fn(() => false);
  room.getReadReceiptForUserId = vi.fn(() =>
    readReceiptTs === 0 ? null : { data: { ts: readReceiptTs } }
  );
  room.getLiveTimeline = vi.fn(() => ({ getEvents: () => liveEvents }));
  return room as unknown as Room;
};

describe('checkIsEventEligibleForNotification', () => {
  it('blocks a live event before the first live sync has completed', () => {
    expect(
      checkIsEventEligibleForNotification({
        mx: makeClient(),
        room: makeRoom(),
        event: createMockMatrixEvent({ sender: OTHER_USER_ID, type: NOTIFYING_EVENT_TYPE }),
        isLiveEvent: true,
        hasCompletedFirstLiveSync: false,
        isTargetRoomVisible: false,
      })
    ).toBe(false);
  });

  it('allows a live event once the first live sync has completed', () => {
    expect(
      checkIsEventEligibleForNotification({
        mx: makeClient(),
        room: makeRoom(),
        event: createMockMatrixEvent({ sender: OTHER_USER_ID, type: NOTIFYING_EVENT_TYPE }),
        isLiveEvent: true,
        hasCompletedFirstLiveSync: true,
        isTargetRoomVisible: false,
      })
    ).toBe(true);
  });

  it('blocks a live event in a room already read by receipt timestamp', () => {
    const alreadyReadEvent = createMockMatrixEvent({
      sender: OTHER_USER_ID,
      type: NOTIFYING_EVENT_TYPE,
      ts: EVENT_TS_BEFORE_RECEIPT,
    });

    expect(
      checkIsEventEligibleForNotification({
        mx: makeClient(),
        room: makeRoom({
          readReceiptTs: READ_RECEIPT_TS,
          liveEvents: [alreadyReadEvent],
        }),
        event: alreadyReadEvent,
        isLiveEvent: true,
        hasCompletedFirstLiveSync: true,
        isTargetRoomVisible: false,
      })
    ).toBe(false);
  });
});
