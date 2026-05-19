import type { MatrixClient } from 'matrix-js-sdk';
import { getAccountData } from '../utils/room';
import { AccountDataEvent } from '../../types/matrix/accountData';
import type { GifItem } from '../utils/gifServer';

export type IFavoriteGifContent = {
  favorites: GifItem[];
};

export const getFavoriteGifs = (mx: MatrixClient): GifItem[] => {
  const event = getAccountData(mx, AccountDataEvent.DurnibleFavoriteGif);
  const content = event?.getContent<IFavoriteGifContent>();
  if (!Array.isArray(content?.favorites)) return [];
  return content.favorites;
};

export function addFavoriteGif(mx: MatrixClient, gif: GifItem): void {
  const current = getFavoriteGifs(mx);
  if (current.some((g) => g.id === gif.id)) return;
  mx.setAccountData(AccountDataEvent.DurnibleFavoriteGif, {
    favorites: [...current, gif],
  });
}

export function removeFavoriteGif(mx: MatrixClient, id: string): void {
  const current = getFavoriteGifs(mx);
  mx.setAccountData(AccountDataEvent.DurnibleFavoriteGif, {
    favorites: current.filter((g) => g.id !== id),
  });
}

export function isFavoriteGif(favorites: GifItem[], id: string): boolean {
  return favorites.some((g) => g.id === id);
}
