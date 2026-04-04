import { useState, useCallback } from 'react';
import { MatrixClient } from 'matrix-js-sdk';
import { getRecentGifs } from '../plugins/recent-gif';
import { AccountDataEvent } from '../../types/matrix/accountData';
import { useAccountDataCallback } from './useAccountDataCallback';
import { GifItem } from '../utils/gifServer';

export const useRecentGifs = (mx: MatrixClient, limit?: number): GifItem[] => {
  const [recents, setRecents] = useState(() => getRecentGifs(mx, limit));

  useAccountDataCallback(
    mx,
    useCallback(
      (evt) => {
        if (evt.getType() === AccountDataEvent.CinnyRecentGif) {
          setRecents(getRecentGifs(mx, limit));
        }
      },
      [mx, limit]
    )
  );

  return recents;
};
