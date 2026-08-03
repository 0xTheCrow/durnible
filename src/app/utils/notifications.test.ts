import { describe, it, expect, vi, afterEach } from 'vitest';
import type { MatrixClient, MatrixEvent, Room } from 'matrix-js-sdk';
import { ReceiptType } from 'matrix-js-sdk';
import { createMockMatrixClient, createMockMatrixEvent } from '../../test/mocks';
import { markAsRead } from './notifications';

const ROOM_ID = '!room:example.com';

type RoomStateOptions = {
  liveEvents: MatrixEvent[];
  readUpToEventId?: string | null;
};

const createClientWithRoom = ({
  liveEvents,
  readUpToEventId = null,
}: RoomStateOptions): MatrixClient => {
  const mx = createMockMatrixClient() as unknown as MatrixClient;
  const room = {
    roomId: ROOM_ID,
    getLiveTimeline: () => ({ getEvents: () => liveEvents }),
    getEventReadUpTo: () => readUpToEventId,
  } as unknown as Room;
  vi.mocked(mx.getRoom).mockReturnValue(room);
  return mx;
};

afterEach(() => {
  vi.clearAllMocks();
});

describe('markAsRead', () => {
  it('sends a receipt for the newest live event when the receipt is behind', async () => {
    const oldest = createMockMatrixEvent({ id: '$oldest' });
    const newest = createMockMatrixEvent({ id: '$newest' });
    const mx = createClientWithRoom({
      liveEvents: [oldest, newest],
      readUpToEventId: '$oldest',
    });

    await markAsRead(mx, ROOM_ID, false);

    expect(vi.mocked(mx.sendReadReceipt)).toHaveBeenCalledWith(newest, ReceiptType.Read);
  });

  it('does not send a receipt when the receipt already points at the newest live event', async () => {
    const newest = createMockMatrixEvent({ id: '$newest' });
    const mx = createClientWithRoom({
      liveEvents: [createMockMatrixEvent({ id: '$oldest' }), newest],
      readUpToEventId: '$newest',
    });

    await markAsRead(mx, ROOM_ID, false);

    expect(vi.mocked(mx.sendReadReceipt)).not.toHaveBeenCalled();
  });

  it('does not send a receipt when the live timeline is empty', async () => {
    const mx = createClientWithRoom({ liveEvents: [] });

    await markAsRead(mx, ROOM_ID, false);

    expect(vi.mocked(mx.sendReadReceipt)).not.toHaveBeenCalled();
  });

  it('skips events that are still sending and receipts the newest settled event', async () => {
    const settled = createMockMatrixEvent({ id: '$settled' });
    const pending = createMockMatrixEvent({ id: '$pending', sending: true });
    const mx = createClientWithRoom({ liveEvents: [settled, pending] });

    await markAsRead(mx, ROOM_ID, false);

    expect(vi.mocked(mx.sendReadReceipt)).toHaveBeenCalledWith(settled, ReceiptType.Read);
  });

  it('sends a private receipt when activity is hidden', async () => {
    const newest = createMockMatrixEvent({ id: '$newest' });
    const mx = createClientWithRoom({ liveEvents: [newest] });

    await markAsRead(mx, ROOM_ID, true);

    expect(vi.mocked(mx.sendReadReceipt)).toHaveBeenCalledWith(newest, ReceiptType.ReadPrivate);
  });
});
