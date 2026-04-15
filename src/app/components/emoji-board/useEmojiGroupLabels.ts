import { useMemo } from 'react';
import { EmojiGroupId } from '../../plugins/emoji';

export type EmojiGroupLabels = Record<EmojiGroupId, string>;

export const useEmojiGroupLabels = (): EmojiGroupLabels =>
  useMemo(
    () => ({
      [EmojiGroupId.People]: 'Smileys & People',
      [EmojiGroupId.Nature]: 'Animals & Nature',
      [EmojiGroupId.Food]: 'Food & Drinks',
      [EmojiGroupId.Activity]: 'Activity',
      [EmojiGroupId.Travel]: 'Travel & Places',
      [EmojiGroupId.Object]: 'Objects',
      [EmojiGroupId.Symbol]: 'Symbols',
      [EmojiGroupId.Flag]: 'Flags',
    }),
    []
  );
