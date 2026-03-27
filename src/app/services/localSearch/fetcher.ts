import { MatrixClient, MatrixEvent, Direction, Method } from 'matrix-js-sdk';
import { IRoomEvent } from 'matrix-js-sdk/lib/sync-accumulator';
import { CryptoBackend } from 'matrix-js-sdk/lib/common-crypto/CryptoBackend';

export type DecryptedMessage = {
  event_id: string;
  room_id: string;
  sender: string;
  origin_server_ts: number;
  body: string;
  type: string;
  content?: Record<string, unknown>;
};

export type StreamPage = {
  newMessages: DecryptedMessage[];
  fetched: number; // cumulative raw events fetched so far
};

const getStartToken = async (
  mx: MatrixClient,
  roomId: string,
  endTs: number
): Promise<string | undefined> => {
  try {
    const result = await mx.timestampToEvent(roomId, endTs, Direction.Backward);
    const path = `/rooms/${encodeURIComponent(roomId)}/context/${encodeURIComponent(result.event_id)}`;
    const context = await mx.http.authedRequest<{ start: string; end: string }>(
      Method.Get,
      path,
      { limit: 0 }
    );
    return context.end;
  } catch {
    const room = mx.getRoom(roomId);
    if (!room) return undefined;
    return room.getLiveTimeline().getPaginationToken(Direction.Backward) ?? undefined;
  }
};

const extractDecryptedMessages = (matrixEvents: MatrixEvent[], roomId: string): DecryptedMessage[] => {
  const messages: DecryptedMessage[] = [];
  for (const mEvt of matrixEvents) {
    const content = mEvt.getContent();
    const body = content?.body;
    if (typeof body !== 'string' || !body) continue;
    if (mEvt.isDecryptionFailure()) continue;
    const msgtype = content.msgtype;
    const isText = msgtype === 'm.text' || msgtype === 'm.notice' || msgtype === 'm.emote';
    const isMedia =
      msgtype === 'm.image' ||
      msgtype === 'm.video' ||
      msgtype === 'm.audio' ||
      msgtype === 'm.file';
    if (!isText && !isMedia) continue;
    messages.push({
      event_id: mEvt.getId() ?? '',
      room_id: roomId,
      sender: mEvt.getSender() ?? '',
      origin_server_ts: mEvt.getTs(),
      body,
      type: msgtype,
      content: isMedia ? (content as Record<string, unknown>) : undefined,
    });
  }
  return messages;
};

/**
 * Async generator that fetches and decrypts messages page by page.
 * Yields after each page so callers can show intermediate results.
 */
export async function* streamFetchDecrypt(
  mx: MatrixClient,
  roomId: string,
  startTs: number,
  endTs: number
): AsyncGenerator<StreamPage> {
  const crypto = mx.getCrypto();
  if (!crypto) return;

  const fromToken = await getStartToken(mx, roomId, endTs);
  if (!fromToken) return;

  let token: string | undefined = fromToken;
  let totalFetched = 0;

  while (token) {
    // eslint-disable-next-line no-await-in-loop
    const response = await mx.createMessagesRequest(
      roomId,
      token,
      1000,
      Direction.Backward,
      undefined
    );
    const { chunk } = response;
    if (!chunk || chunk.length === 0) break;

    const pageRaw: IRoomEvent[] = [];
    let reachedStart = false;
    for (const evt of chunk) {
      if (evt.origin_server_ts < startTs) {
        reachedStart = true;
        break;
      }
      if (evt.origin_server_ts > endTs) continue;
      if (evt.type === 'm.room.message' || evt.type === 'm.room.encrypted') {
        pageRaw.push(evt);
      }
    }

    totalFetched += chunk.length;

    const matrixEvents = pageRaw.map((raw) => new MatrixEvent(raw));
    // eslint-disable-next-line no-await-in-loop
    await Promise.allSettled(
      matrixEvents
        .filter((e) => e.isEncrypted())
        .map((e) => e.attemptDecryption(crypto as CryptoBackend, { isRetry: true }))
    );

    const newMessages = extractDecryptedMessages(matrixEvents, roomId);
    yield { newMessages, fetched: totalFetched };

    if (reachedStart) break;
    token = response.end ?? undefined;
  }
}
