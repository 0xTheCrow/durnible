import { MatrixClient } from 'matrix-js-sdk';
import { DecryptedMessage, fetchAndDecryptMessages, OnProgress } from './fetcher';

export type LocalSearchResult = {
  event_id: string;
  room_id: string;
  sender: string;
  origin_server_ts: number;
  body: string;
  type: string;
};

type RoomCache = {
  startTs: number;
  endTs: number;
  messages: DecryptedMessage[];
};

// Module-level cache: lives for the browser session, GC'd on tab close/refresh
const roomCaches = new Map<string, RoomCache>();

export const searchEncryptedRoom = async (
  mx: MatrixClient,
  roomId: string,
  query: string,
  startTs: number,
  endTs: number,
  onProgress?: OnProgress
): Promise<LocalSearchResult[]> => {
  const cached = roomCaches.get(roomId);

  // Use cache if it fully covers the requested range
  let messages: DecryptedMessage[];
  if (cached && cached.startTs <= startTs && cached.endTs >= endTs) {
    messages = cached.messages;
  } else {
    // Expand range to cover both cached and requested ranges
    const fetchStart = cached ? Math.min(startTs, cached.startTs) : startTs;
    const fetchEnd = cached ? Math.max(endTs, cached.endTs) : endTs;

    const fetched = await fetchAndDecryptMessages(mx, roomId, fetchStart, fetchEnd, onProgress);

    // Merge with existing cache, dedup by event_id
    if (cached) {
      const existingIds = new Set(cached.messages.map((m) => m.event_id));
      const newMessages = fetched.filter((m) => !existingIds.has(m.event_id));
      messages = [...cached.messages, ...newMessages];
    } else {
      messages = fetched;
    }

    roomCaches.set(roomId, { startTs: fetchStart, endTs: fetchEnd, messages });
  }

  // Filter by date range and query
  const queryLower = query.toLowerCase();
  const results = messages.filter(
    (msg) =>
      msg.origin_server_ts >= startTs &&
      msg.origin_server_ts <= endTs &&
      msg.body.toLowerCase().includes(queryLower)
  );

  results.sort((a, b) => b.origin_server_ts - a.origin_server_ts);

  return results;
};
