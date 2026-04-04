import { useState, useCallback } from 'react';
import { MatrixClient } from 'matrix-js-sdk';
import { getFavoriteGifs } from '../plugins/favorite-gif';
import { AccountDataEvent } from '../../types/matrix/accountData';
import { useAccountDataCallback } from './useAccountDataCallback';
import { GifItem } from '../utils/gifServer';

export const useFavoriteGifs = (mx: MatrixClient): GifItem[] => {
  const [favorites, setFavorites] = useState(() => getFavoriteGifs(mx));

  useAccountDataCallback(
    mx,
    useCallback(
      (evt) => {
        if (evt.getType() === AccountDataEvent.CinnyFavoriteGif) {
          setFavorites(getFavoriteGifs(mx));
        }
      },
      [mx]
    )
  );

  return favorites;
};
