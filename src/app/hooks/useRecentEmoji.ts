import { useEffect, useState } from 'react';
import type { MatrixClient, MatrixEvent } from 'matrix-js-sdk';
import { ClientEvent } from 'matrix-js-sdk';
import { getRecentEmojis } from '../plugins/recent-emoji';
import { AccountDataEvent } from '../../types/matrix/accountData';
import type { Emoji } from '../plugins/emoji';
import { useEmojiData } from './useEmojiData';

export const useRecentEmoji = (mx: MatrixClient, limit?: number): Emoji[] => {
  const { emojis } = useEmojiData();
  const [recentEmoji, setRecentEmoji] = useState(() => getRecentEmojis(mx, emojis, limit));

  useEffect(() => {
    setRecentEmoji(getRecentEmojis(mx, emojis, limit));

    const handleAccountData = (event: MatrixEvent) => {
      if (event.getType() !== AccountDataEvent.ElementRecentEmoji) return;
      setRecentEmoji(getRecentEmojis(mx, emojis, limit));
    };

    mx.on(ClientEvent.AccountData, handleAccountData);
    return () => {
      mx.removeListener(ClientEvent.AccountData, handleAccountData);
    };
  }, [mx, limit, emojis]);

  return recentEmoji;
};
