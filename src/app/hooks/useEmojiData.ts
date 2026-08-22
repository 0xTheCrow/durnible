import { useSyncExternalStore } from 'react';
import type { EmojiData } from '../plugins/emoji';
import { getEmojiData, subscribeToEmojiData } from '../plugins/emoji';

export const useEmojiData = (): EmojiData =>
  useSyncExternalStore(subscribeToEmojiData, getEmojiData, getEmojiData);
