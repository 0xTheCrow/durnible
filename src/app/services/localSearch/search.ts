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

const MAX_CACHED_MESSAGES = 100_000;

// Module-level cache: lives for the browser session, GC'd on tab close/refresh
const roomCaches = new Map<string, RoomCache>();
let wasTrimmed = false;

export const wasMessageCapExceeded = (): boolean => wasTrimmed;

const getTotalCachedCount = (): number => {
  let total = 0;
  for (const cache of roomCaches.values()) {
    total += cache.messages.length;
  }
  return total;
};

const trimCache = () => {
  const total = getTotalCachedCount();
  if (total <= MAX_CACHED_MESSAGES) {
    wasTrimmed = false;
    return;
  }

  const excess = total - MAX_CACHED_MESSAGES;

  // Collect all messages with their room reference, sorted oldest first
  const all: { ts: number; eventId: string; roomId: string }[] = [];
  for (const [roomId, cache] of roomCaches) {
    for (const msg of cache.messages) {
      all.push({ ts: msg.origin_server_ts, eventId: msg.event_id, roomId });
    }
  }
  all.sort((a, b) => a.ts - b.ts);

  // Mark the oldest messages for removal
  const toRemove = new Set<string>();
  for (let i = 0; i < excess && i < all.length; i++) {
    toRemove.add(all[i].eventId);
  }

  // Remove from each room's cache and update startTs
  for (const [roomId, cache] of roomCaches) {
    const filtered = cache.messages.filter((m) => !toRemove.has(m.event_id));
    if (filtered.length === 0) {
      roomCaches.delete(roomId);
    } else {
      const newStartTs = Math.min(...filtered.map((m) => m.origin_server_ts));
      roomCaches.set(roomId, { startTs: newStartTs, endTs: cache.endTs, messages: filtered });
    }
  }

  wasTrimmed = true;
};

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
    console.log('[search] cache HIT for', roomId, '- using', cached.messages.length, 'cached messages');
    messages = cached.messages;
  } else {
    console.log('[search] cache MISS for', roomId, cached ? '- expanding range' : '- no cache');
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
    trimCache();
  }

  // Filter by date range and query
  const queryLower = query.toLowerCase();
  const results = messages.filter(
    (msg) =>
      msg.origin_server_ts >= startTs &&
      msg.origin_server_ts <= endTs &&
      msg.body.toLowerCase().includes(queryLower)
  );

  return results;
};
