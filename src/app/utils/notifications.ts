import type { MatrixClient, MatrixEvent, Room } from 'matrix-js-sdk';
import { NotificationCountType, ReceiptType } from 'matrix-js-sdk';

const clearStaleNotificationCount = (
  room: Room,
  userId: string,
  latestEvent: MatrixEvent,
  receiptType: ReceiptType,
  isAlreadyRead: boolean
) => {
  if (!room.hasEncryptionStateEvent()) return;
  if (
    room.getUnreadNotificationCount(NotificationCountType.Total) === 0 &&
    room.getUnreadNotificationCount(NotificationCountType.Highlight) === 0
  ) {
    return;
  }

  room.setUnreadNotificationCount(NotificationCountType.Total, 0);
  room.setUnreadNotificationCount(NotificationCountType.Highlight, 0);
  room.resetThreadUnreadNotificationCountFromSync();

  if (isAlreadyRead) {
    room.addLocalEchoReceipt(userId, latestEvent, receiptType);
  }
};

export async function markAsRead(mx: MatrixClient, roomId: string, privateReceipt: boolean) {
  const room = mx.getRoom(roomId);
  if (!room) return;

  const userId = mx.getUserId();
  if (!userId) return;

  const timeline = room.getLiveTimeline().getEvents();
  if (timeline.length === 0) return;

  const readEventId = room.getEventReadUpTo(userId);

  let latestEvent: MatrixEvent | null = null;
  for (let i = timeline.length - 1; i >= 0; i -= 1) {
    if (!timeline[i].isSending()) {
      latestEvent = timeline[i];
      break;
    }
  }
  if (latestEvent === null) return;

  const receiptType = privateReceipt ? ReceiptType.ReadPrivate : ReceiptType.Read;
  const isAlreadyRead = latestEvent.getId() === readEventId;

  if (!isAlreadyRead) {
    await mx.sendReadReceipt(latestEvent, receiptType);
  }

  clearStaleNotificationCount(room, userId, latestEvent, receiptType, isAlreadyRead);
}
