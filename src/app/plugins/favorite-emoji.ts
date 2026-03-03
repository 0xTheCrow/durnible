import { MatrixClient } from 'matrix-js-sdk';
import { getAccountData } from '../utils/room';
import { IEmoji, emojis } from './emoji';
import { PackImageReader } from './custom-emoji';
import { AccountDataEvent } from '../../types/matrix/accountData';
import { EmojiType } from '../components/emoji-board/types';

export type FavoriteEmojiEntry = {
  type: 'emoji' | 'customEmoji' | 'sticker';
  data: string;
  shortcode: string;
  label: string;
};

export type IFavoriteEmojiContent = {
  favorites: FavoriteEmojiEntry[];
};

export const getFavoriteEmojis = (mx: MatrixClient): FavoriteEmojiEntry[] => {
  const event = getAccountData(mx, AccountDataEvent.CinnyFavoriteEmoji);
  const content = event?.getContent<IFavoriteEmojiContent>();
  if (!Array.isArray(content?.favorites)) return [];
  return content.favorites;
};

export const getFavoriteEmojiItems = (
  mx: MatrixClient
): Array<IEmoji | PackImageReader> => {
  const entries = getFavoriteEmojis(mx);
  return entries.reduce<Array<IEmoji | PackImageReader>>((list, entry) => {
    if (entry.type === EmojiType.Emoji) {
      const emoji = emojis.find((e) => e.unicode === entry.data);
      if (emoji) list.push(emoji);
    } else {
      list.push(new PackImageReader(entry.shortcode, entry.data, { body: entry.label }));
    }
    return list;
  }, []);
};

export function addFavoriteEmoji(mx: MatrixClient, entry: FavoriteEmojiEntry) {
  const current = getFavoriteEmojis(mx);
  const exists = current.some((e) => e.type === entry.type && e.data === entry.data);
  if (exists) return;
  mx.setAccountData(AccountDataEvent.CinnyFavoriteEmoji, {
    favorites: [...current, entry],
  });
}

export function removeFavoriteEmoji(
  mx: MatrixClient,
  type: string,
  data: string
) {
  const current = getFavoriteEmojis(mx);
  mx.setAccountData(AccountDataEvent.CinnyFavoriteEmoji, {
    favorites: current.filter((e) => !(e.type === type && e.data === data)),
  });
}

export function isFavoriteEmoji(
  entries: FavoriteEmojiEntry[],
  type: string,
  data: string
): boolean {
  return entries.some((e) => e.type === type && e.data === data);
}
