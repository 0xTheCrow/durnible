import { MatrixClient } from 'matrix-js-sdk';
import { searchDb } from './db';
import { indexMessages, getRoomMeta, updateRoomMeta } from './indexManager';
import { fetchAndDecryptMessages, OnProgress } from './fetcher';

export type LocalSearchResult = {
  event_id: string;
  room_id: string;
  sender: string;
  origin_server_ts: number;
  body: string;
  type: string;
};

/**
 * Search an encrypted room's messages locally.
 * Fetches and indexes messages on demand if they haven't been cached yet.
 */
export const searchEncryptedRoom = async (
  mx: MatrixClient,
  roomId: string,
  query: string,
  startTs: number,
  endTs: number,
  onProgress?: OnProgress
): Promise<LocalSearchResult[]> => {
  // Check if we need to fetch messages for this range
  const meta = await getRoomMeta(roomId);
  const needsFetch =
    !meta || meta.fetched_until_ts > startTs || meta.fetched_from_ts < endTs;

  if (needsFetch) {
    // Determine what range we actually need to fetch
    const fetchStart = meta ? Math.min(startTs, meta.fetched_until_ts) : startTs;
    const fetchEnd = meta ? Math.max(endTs, meta.fetched_from_ts) : endTs;

    const messages = await fetchAndDecryptMessages(mx, roomId, fetchStart, fetchEnd, onProgress);
    await indexMessages(messages);
    await updateRoomMeta(roomId, fetchStart, fetchEnd);
  }

  // Query the local index
  const queryLower = query.toLowerCase();
  const results = await searchDb.messages
    .where('room_id')
    .equals(roomId)
    .and(
      (msg) =>
        msg.origin_server_ts >= startTs &&
        msg.origin_server_ts <= endTs &&
        msg.body.toLowerCase().includes(queryLower)
    )
    .toArray();

  // Sort by timestamp descending (most recent first)
  results.sort((a, b) => b.origin_server_ts - a.origin_server_ts);

  return results.map((msg) => ({
    event_id: msg.event_id,
    room_id: msg.room_id,
    sender: msg.sender,
    origin_server_ts: msg.origin_server_ts,
    body: msg.body,
    type: msg.type,
  }));
};
