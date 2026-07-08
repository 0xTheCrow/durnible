import type { MatrixClient, Room } from 'matrix-js-sdk';
import { MatrixEvent, Method, ReceiptType } from 'matrix-js-sdk';

export const RECEIPT_SYNC_CHUNK_SIZE = 50;

type ReceiptSyncResponse = {
  rooms?: {
    join?: Record<
      string,
      {
        ephemeral?: {
          events?: Array<{ type: string; content: Record<string, unknown> }>;
        };
      }
    >;
  };
};

const fetchAndInjectReceipts = async (mx: MatrixClient, roomIds: string[]): Promise<void> => {
  const filter = {
    room: {
      rooms: roomIds,
      timeline: { limit: 1 },
      state: { types: [] },
      account_data: { types: [] },
    },
    presence: { types: [] },
    account_data: { types: [] },
  };
  const response = await mx.http.authedRequest<ReceiptSyncResponse>(Method.Get, '/sync', {
    filter: JSON.stringify(filter),
    timeout: 0,
  });
  Object.entries(response.rooms?.join ?? {}).forEach(([roomId, joinedRoom]) => {
    const room = mx.getRoom(roomId);
    if (!room) return;
    joinedRoom.ephemeral?.events
      ?.filter((event) => event.type === 'm.receipt')
      .forEach((event) => {
        room.addReceipt(new MatrixEvent({ type: event.type, content: event.content }));
      });
  });
};

export const syncRoomReceiptsFromServer = async (
  mx: MatrixClient,
  roomIds: string[]
): Promise<void> => {
  const chunks: string[][] = [];
  for (let start = 0; start < roomIds.length; start += RECEIPT_SYNC_CHUNK_SIZE) {
    chunks.push(roomIds.slice(start, start + RECEIPT_SYNC_CHUNK_SIZE));
  }
  await Promise.all(chunks.map((chunk) => fetchAndInjectReceipts(mx, chunk)));
};

export const getMyLatestReadReceiptTs = (room: Room, userId: string): number => {
  const publicReceipt = room.getReadReceiptForUserId(userId, false, ReceiptType.Read);
  const privateReceipt = room.getReadReceiptForUserId(userId, false, ReceiptType.ReadPrivate);
  return Math.max(publicReceipt?.data.ts ?? 0, privateReceipt?.data.ts ?? 0);
};

export const getReadReceiptEventId = (room: Room, userId: string): string | undefined => {
  const publicReceipt = room.getReadReceiptForUserId(userId, false, ReceiptType.Read);
  const privateReceipt = room.getReadReceiptForUserId(userId, false, ReceiptType.ReadPrivate);
  if (publicReceipt && privateReceipt) {
    return privateReceipt.data.ts >= publicReceipt.data.ts
      ? privateReceipt.eventId
      : publicReceipt.eventId;
  }
  return (privateReceipt ?? publicReceipt)?.eventId;
};
