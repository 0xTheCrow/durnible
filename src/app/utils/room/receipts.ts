import type { Room } from 'matrix-js-sdk';
import { ReceiptType } from 'matrix-js-sdk';

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
