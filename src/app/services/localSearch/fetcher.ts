import { MatrixClient, MatrixEvent, Direction, IEvent, Method } from 'matrix-js-sdk';
import { CryptoBackend } from 'matrix-js-sdk/lib/common-crypto/CryptoBackend';
import { IndexedMessage } from './db';

export type FetchProgress = {
  fetched: number;
  decrypting: boolean;
};

export type OnProgress = (progress: FetchProgress) => void;

/**
 * Fetch and decrypt messages from an encrypted room within a time range.
 * Uses timestamp_to_event to get pagination tokens, then paginates backwards.
 */
export const fetchAndDecryptMessages = async (
  mx: MatrixClient,
  roomId: string,
  startTs: number,
  endTs: number,
  onProgress?: OnProgress
): Promise<IndexedMessage[]> => {
  const userId = mx.getSafeUserId();
  const crypto = mx.getCrypto();
  if (!crypto) return [];

  // Get a pagination token near endTs by finding the event at that timestamp
  let fromToken: string | undefined;
  try {
    const result = await mx.timestampToEvent(roomId, endTs, Direction.Backward);
    console.log('[fetcher] timestampToEvent succeeded, event_id:', result.event_id);
    const eventId = result.event_id;
    const path = `/rooms/${encodeURIComponent(roomId)}/context/${encodeURIComponent(eventId)}`;
    const context = await mx.http.authedRequest<{ start: string; end: string }>(
      Method.Get,
      path,
      { limit: 0 }
    );
    fromToken = context.end;
  } catch (err) {
    console.log('[fetcher] timestampToEvent failed, using fallback:', err);
    // If timestamp_to_event fails, fall back to the room's live timeline end token
    const room = mx.getRoom(roomId);
    if (!room) return [];
    const liveTimeline = room.getLiveTimeline();
    fromToken = liveTimeline.getPaginationToken(Direction.Backward) ?? undefined;
  }

  if (!fromToken) return [];

  console.log('[fetcher] range:', new Date(startTs).toISOString(), 'to', new Date(endTs).toISOString());
  console.log('[fetcher] fromToken:', fromToken);

  // Paginate backwards collecting raw events
  const rawEvents: IEvent[] = [];
  let token: string | undefined = fromToken;
  let fetched = 0;
  let pages = 0;

  while (token) {
    // eslint-disable-next-line no-await-in-loop
    const response: { chunk: IEvent[]; end?: string; start?: string } =
      await mx.createMessagesRequest(roomId, token, 100, Direction.Backward, undefined);

    const { chunk } = response;
    if (!chunk || chunk.length === 0) break;

    pages += 1;
    const firstTs = chunk[0]?.origin_server_ts;
    const lastTs = chunk[chunk.length - 1]?.origin_server_ts;
    console.log(`[fetcher] page ${pages}: ${chunk.length} events, range ${new Date(lastTs).toISOString()} - ${new Date(firstTs).toISOString()}`);

    let reachedStart = false;
    for (const evt of chunk) {
      // Stop if we've gone past startTs
      if (evt.origin_server_ts < startTs) {
        reachedStart = true;
        break;
      }
      // Skip events newer than endTs (can happen when using fallback token)
      if (evt.origin_server_ts > endTs) continue;
      if (evt.type === 'm.room.message' || evt.type === 'm.room.encrypted') {
        rawEvents.push(evt as IEvent);
      }
    }

    fetched += chunk.length;
    onProgress?.({ fetched, decrypting: false });

    if (reachedStart) {
      console.log('[fetcher] reached startTs, stopping');
      break;
    }
    token = response.end ?? undefined;
  }

  // Decrypt all collected events
  onProgress?.({ fetched, decrypting: true });

  const matrixEvents = rawEvents.map((raw) => new MatrixEvent(raw));
  await Promise.allSettled(
    matrixEvents
      .filter((evt) => evt.isEncrypted())
      .map((evt) => evt.attemptDecryption(crypto as CryptoBackend, { isRetry: true }))
  );

  // Extract plaintext messages, skip UTD (unable to decrypt) events
  const messages: IndexedMessage[] = [];
  for (const mEvt of matrixEvents) {
    const content = mEvt.getContent();
    const body = content?.body;
    if (typeof body !== 'string' || !body) continue;
    // Skip events that are still encrypted (decryption failed)
    if (mEvt.isDecryptionFailure()) continue;

    messages.push({
      event_id: mEvt.getId() ?? '',
      room_id: roomId,
      sender: mEvt.getSender() ?? '',
      origin_server_ts: mEvt.getTs(),
      user_id: userId,
      body,
      type: content.msgtype ?? 'm.text',
    });
  }

  return messages;
};
