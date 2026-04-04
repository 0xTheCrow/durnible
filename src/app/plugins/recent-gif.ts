import { MatrixClient } from 'matrix-js-sdk';
import { getAccountData } from '../utils/room';
import { AccountDataEvent } from '../../types/matrix/accountData';
import { GifItem } from '../utils/gifServer';

const RECENT_LIMIT = 50;

export type IRecentGifContent = {
  recent: GifItem[];
};

export const getRecentGifs = (mx: MatrixClient, limit?: number): GifItem[] => {
  const event = getAccountData(mx, AccountDataEvent.CinnyRecentGif);
  const content = event?.getContent<IRecentGifContent>();
  if (!Array.isArray(content?.recent)) return [];
  return content.recent.slice(0, limit);
};

export function addRecentGif(mx: MatrixClient, gif: GifItem): void {
  const current = getRecentGifs(mx);
  const filtered = current.filter((g) => g.id !== gif.id);
  mx.setAccountData(AccountDataEvent.CinnyRecentGif, {
    recent: [gif, ...filtered].slice(0, RECENT_LIMIT),
  });
}
