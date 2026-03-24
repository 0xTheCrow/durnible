import { MatrixClient } from 'matrix-js-sdk';
import { DecryptedMessage, fetchAndDecryptMessages, OnProgress } from './fetcher';

export type AttachedImage = {
  event_id: string;
  content: Record<string, unknown>;
};

export type LocalSearchResult = {
  event_id: string;
  room_id: string;
  sender: string;
  origin_server_ts: number;
  body: string;
  type: string;
  attachedImages?: AttachedImage[];
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

export const addLiveMessageToCache = (roomId: string, message: DecryptedMessage): void => {
  const cached = roomCaches.get(roomId);
  if (!cached) return;

  if (cached.messages.some((m) => m.event_id === message.event_id)) return;

  cached.messages.push(message);

  if (message.origin_server_ts > cached.endTs) {
    cached.endTs = message.origin_server_ts;
  }
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
    messages = cached.messages;
  } else if (cached) {
    // Only fetch the gap(s) not covered by the cache
    const gaps: { start: number; end: number }[] = [];
    if (startTs < cached.startTs) {
      gaps.push({ start: startTs, end: cached.startTs });
    }
    if (endTs > cached.endTs) {
      gaps.push({ start: cached.endTs, end: endTs });
    }

    const gapResults = await Promise.all(
      gaps.map((gap) => fetchAndDecryptMessages(mx, roomId, gap.start, gap.end, onProgress))
    );
    const newMessages = gapResults.flat();

    const existingIds = new Set(cached.messages.map((m) => m.event_id));
    const deduped = newMessages.filter((m) => !existingIds.has(m.event_id));
    messages = [...cached.messages, ...deduped];

    const newStartTs = Math.min(startTs, cached.startTs);
    const newEndTs = Math.max(endTs, cached.endTs);
    roomCaches.set(roomId, { startTs: newStartTs, endTs: newEndTs, messages });
    trimCache();
  } else {
    const fetched = await fetchAndDecryptMessages(mx, roomId, startTs, endTs, onProgress);
    messages = fetched;

    roomCaches.set(roomId, { startTs, endTs, messages });
    trimCache();
  }

  // Parse query into terms: split on spaces, but keep quoted phrases together
  const terms: string[] = [];
  const regex = /"([^"]+)"|(\S+)/g;
  let match = regex.exec(query);
  while (match) {
    terms.push((match[1] ?? match[2]).toLowerCase());
    match = regex.exec(query);
  }

  // Filter by date range and all terms (AND), only on text messages
  const TEXT_TYPES = new Set(['m.text', 'm.notice', 'm.emote']);
  const ADJACENCY_MS = 60_000;

  const textMatches = messages.filter(
    (msg) => {
      if (!TEXT_TYPES.has(msg.type)) return false;
      if (msg.origin_server_ts < startTs || msg.origin_server_ts > endTs) return false;
      const bodyLower = msg.body.toLowerCase();
      return terms.every((term) => bodyLower.includes(term));
    }
  );

  // For each text match, find adjacent image messages from the same sender within 1 minute
  const results: LocalSearchResult[] = textMatches.map((msg) => {
    const adjacentImages = messages.filter(
      (m) =>
        m.type === 'm.image' &&
        m.sender === msg.sender &&
        m.content &&
        Math.abs(m.origin_server_ts - msg.origin_server_ts) <= ADJACENCY_MS
    );

    return {
      ...msg,
      attachedImages: adjacentImages.length > 0
        ? adjacentImages.map((img) => ({ event_id: img.event_id, content: img.content! }))
        : undefined,
    };
  });

  return results;
};
