import type { MatrixClient } from 'matrix-js-sdk';
import type { DecryptedMessage } from './fetcher';
import { fetchUnseenMessages, streamFetchDecrypt } from './fetcher';

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
  content?: Record<string, unknown>;
  attachedImages?: AttachedImage[];
};

export type SearchStreamChunk = {
  roomId: string;
  results: LocalSearchResult[]; // all results accumulated so far for this room
  fetched: number; // cumulative raw events fetched
  decrypted: number; // cumulative messages extracted
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
  const all: { ts: number; eventId: string; roomId: string }[] = [];
  for (const [roomId, cache] of roomCaches) {
    for (const msg of cache.messages) {
      all.push({ ts: msg.origin_server_ts, eventId: msg.event_id, roomId });
    }
  }
  all.sort((a, b) => a.ts - b.ts);

  const toRemove = new Set<string>();
  for (let i = 0; i < excess && i < all.length; i++) {
    toRemove.add(all[i].eventId);
  }

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

const parseTerms = (query: string): string[] => {
  const terms: string[] = [];
  const regex = /"([^"]+)"|(\S+)/g;
  let match = regex.exec(query);
  while (match) {
    terms.push((match[1] ?? match[2]).toLowerCase());
    match = regex.exec(query);
  }
  return terms;
};

const TEXT_TYPES = new Set(['m.text', 'm.notice', 'm.emote']);
const HAS_TYPE_MAP: Record<string, string> = {
  image: 'm.image',
  video: 'm.video',
  file: 'm.file',
  audio: 'm.audio',
};
const URL_REGEX = /https?:\/\/\S+/i;
const ADJACENCY_MS = 60_000;

const filterAndBuild = (
  allMessages: DecryptedMessage[],
  terms: string[],
  startTs: number,
  endTs: number,
  senders?: string[],
  hasTypes?: string[]
): LocalSearchResult[] => {
  const mediaTypeSet = new Set<string>();
  const hasLink = hasTypes?.includes('link') ?? false;
  if (hasTypes) {
    for (const ht of hasTypes) {
      const mapped = HAS_TYPE_MAP[ht];
      if (mapped) mediaTypeSet.add(mapped);
    }
  }

  const matched = allMessages.filter((msg) => {
    if (msg.origin_server_ts < startTs || msg.origin_server_ts > endTs) return false;
    if (senders && senders.length > 0 && !senders.includes(msg.sender)) return false;

    const isText = TEXT_TYPES.has(msg.type);
    const isMatchedMedia = mediaTypeSet.has(msg.type);

    if (mediaTypeSet.size > 0 || hasLink) {
      if (!isMatchedMedia) {
        if (!isText) return false;
        const passesLink = hasLink && URL_REGEX.test(msg.body);
        const passesTextWithTerms = mediaTypeSet.size > 0 && terms.length > 0;
        if (!passesLink && !passesTextWithTerms) return false;
      }
    } else if (!isText) return false;

    if (terms.length === 0) return true;
    const bodyLower = msg.body.toLowerCase();
    return terms.every((term) => bodyLower.includes(term));
  });

  return matched.map((msg) => {
    if (!TEXT_TYPES.has(msg.type)) return { ...msg, content: msg.content };
    const attachedImages = allMessages.flatMap((m) => {
      if (
        m.type !== 'm.image' ||
        m.sender !== msg.sender ||
        !m.content ||
        Math.abs(m.origin_server_ts - msg.origin_server_ts) > ADJACENCY_MS
      ) {
        return [];
      }
      return [{ event_id: m.event_id, content: m.content }];
    });
    return {
      ...msg,
      attachedImages: attachedImages.length > 0 ? attachedImages : undefined,
    };
  });
};

/**
 * Async generator that searches an encrypted room, yielding results after each
 * fetched+decrypted page so the UI can show intermediate results.
 * On a full cache hit, yields once immediately and returns.
 */
export async function* streamSearchEncryptedRoom(
  mx: MatrixClient,
  roomId: string,
  query: string,
  startTs: number,
  endTs: number,
  senders?: string[],
  hasTypes?: string[]
): AsyncGenerator<SearchStreamChunk> {
  const cached = roomCaches.get(roomId);

  // Full cache hit — yield immediately
  if (cached && cached.startTs <= startTs && cached.endTs >= endTs) {
    const terms = parseTerms(query);
    const results = filterAndBuild(cached.messages, terms, startTs, endTs, senders, hasTypes);
    yield { roomId, results, fetched: 0, decrypted: cached.messages.length };
    return;
  }

  const terms = parseTerms(query);

  // Seed with unseen messages from the live timeline so they're immediately
  // searchable. These are messages that arrived via sync but haven't been
  // viewed, and may fail decryption when re-fetched from the server cold.
  const unseenMessages = await fetchUnseenMessages(mx, roomId);
  const seenEventIds = new Set<string>(unseenMessages.map((m) => m.event_id));
  const allMessages: DecryptedMessage[] = [...unseenMessages];

  if (allMessages.length > 0) {
    const results = filterAndBuild(allMessages, terms, startTs, endTs, senders, hasTypes);
    yield { roomId, results, fetched: 0, decrypted: allMessages.length };
  }

  for await (const page of streamFetchDecrypt(mx, roomId, startTs, endTs)) {
    // Skip any messages already captured from the live timeline
    const newMessages = page.newMessages.filter((m) => !seenEventIds.has(m.event_id));
    for (const m of newMessages) seenEventIds.add(m.event_id);
    allMessages.push(...newMessages);
    const results = filterAndBuild(allMessages, terms, startTs, endTs, senders, hasTypes);
    yield { roomId, results, fetched: page.fetched, decrypted: allMessages.length };
  }

  // Populate cache after streaming completes
  if (allMessages.length > 0) {
    roomCaches.set(roomId, { startTs, endTs, messages: allMessages });
    trimCache();
  }
}
