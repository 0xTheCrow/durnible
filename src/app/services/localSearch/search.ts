import { MatrixClient } from 'matrix-js-sdk';
import { fetchAndDecryptMessages, OnProgress } from './fetcher';

export type LocalSearchResult = {
  event_id: string;
  room_id: string;
  sender: string;
  origin_server_ts: number;
  body: string;
  type: string;
};

export const searchEncryptedRoom = async (
  mx: MatrixClient,
  roomId: string,
  query: string,
  startTs: number,
  endTs: number,
  onProgress?: OnProgress
): Promise<LocalSearchResult[]> => {
  const messages = await fetchAndDecryptMessages(mx, roomId, startTs, endTs, onProgress);

  const queryLower = query.toLowerCase();
  const results = messages.filter((msg) => msg.body.toLowerCase().includes(queryLower));

  results.sort((a, b) => b.origin_server_ts - a.origin_server_ts);

  return results;
};
