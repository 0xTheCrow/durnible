import { searchDb, IndexedMessage } from './db';

export const indexMessages = async (messages: IndexedMessage[]): Promise<void> => {
  if (messages.length === 0) return;
  await searchDb.messages.bulkPut(messages);
};

export const updateRoomMeta = async (
  roomId: string,
  fetchedUntilTs: number,
  fetchedFromTs: number
): Promise<void> => {
  const existing = await searchDb.roomMeta.get(roomId);
  await searchDb.roomMeta.put({
    room_id: roomId,
    fetched_until_ts: existing
      ? Math.min(existing.fetched_until_ts, fetchedUntilTs)
      : fetchedUntilTs,
    fetched_from_ts: existing ? Math.max(existing.fetched_from_ts, fetchedFromTs) : fetchedFromTs,
  });
};

export const getRoomMeta = async (roomId: string) => searchDb.roomMeta.get(roomId);

export const clearIndex = async (): Promise<void> => {
  await searchDb.messages.clear();
  await searchDb.roomMeta.clear();
  await searchDb.userMeta.clear();
};

export const clearIndexIfUserChanged = async (currentUserId: string): Promise<void> => {
  const stored = await searchDb.userMeta.get('current');
  if (stored && stored.user_id !== currentUserId) {
    await clearIndex();
  }
  await searchDb.userMeta.put({ key: 'current', user_id: currentUserId });
};
