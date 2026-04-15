import { useState, useCallback } from 'react';
import type { MatrixClient } from 'matrix-js-sdk';
import type { FavoriteEmojiEntry } from '../plugins/favorite-emoji';
import { getFavoriteEmojis, getFavoriteEmojiItems } from '../plugins/favorite-emoji';
import { AccountDataEvent } from '../../types/matrix/accountData';
import { useAccountDataCallback } from './useAccountDataCallback';
import type { Emoji } from '../plugins/emoji';
import type { PackImageReader } from '../plugins/custom-emoji';

export const useFavoriteEmoji = (mx: MatrixClient): Array<Emoji | PackImageReader> => {
  const [items, setItems] = useState(() => getFavoriteEmojiItems(mx));

  useAccountDataCallback(
    mx,
    useCallback(
      (evt) => {
        if (evt.getType() === AccountDataEvent.CinnyFavoriteEmoji) {
          setItems(getFavoriteEmojiItems(mx));
        }
      },
      [mx]
    )
  );

  return items;
};

export const useFavoriteEntries = (mx: MatrixClient): FavoriteEmojiEntry[] => {
  const [entries, setEntries] = useState(() => getFavoriteEmojis(mx));

  useAccountDataCallback(
    mx,
    useCallback(
      (evt) => {
        if (evt.getType() === AccountDataEvent.CinnyFavoriteEmoji) {
          setEntries(getFavoriteEmojis(mx));
        }
      },
      [mx]
    )
  );

  return entries;
};
