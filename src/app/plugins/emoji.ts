import type { CompactEmoji } from 'emojibase';
import { fromUnicodeToHexcode } from 'emojibase';
import joypixels from 'emojibase-data/en/shortcodes/joypixels.json';
import emojibase from 'emojibase-data/en/shortcodes/emojibase.json';
import type { ImagePack } from './custom-emoji/ImagePack';
import { ImageUsage } from './custom-emoji/types';

export type Emoji = CompactEmoji & {
  shortcode: string;
};

export enum EmojiGroupId {
  People = 'People',
  Nature = 'Nature',
  Food = 'Food',
  Activity = 'Activity',
  Travel = 'Travel',
  Object = 'Object',
  Symbol = 'Symbol',
  Flag = 'Flag',
}

export type EmojiGroup = {
  id: EmojiGroupId;
  order: number;
  emojis: Emoji[];
};

export type EmojiData = {
  emojis: Emoji[];
  emojiGroups: EmojiGroup[];
};

export const getShortcodesFor = (hexcode: string): string[] | string | undefined =>
  joypixels[hexcode] || emojibase[hexcode];

export const getShortcodeFor = (hexcode: string): string | undefined => {
  const shortcode = joypixels[hexcode] || emojibase[hexcode];
  return Array.isArray(shortcode) ? shortcode[0] : shortcode;
};

export const getHexcodeForEmoji = fromUnicodeToHexcode;

const EMPTY_EMOJI_DATA: EmojiData = { emojis: [], emojiGroups: [] };

let loadedEmojiData: EmojiData = EMPTY_EMOJI_DATA;
let emojiDataPromise: Promise<EmojiData> | undefined;
const emojiDataListeners = new Set<() => void>();

export const getEmojiData = (): EmojiData => loadedEmojiData;

export const subscribeToEmojiData = (listener: () => void): (() => void) => {
  emojiDataListeners.add(listener);
  return () => {
    emojiDataListeners.delete(listener);
  };
};

export const loadEmojiData = (): Promise<EmojiData> => {
  emojiDataPromise ??= import('./emojiData')
    .then((module) => {
      loadedEmojiData = { emojis: module.emojis, emojiGroups: module.emojiGroups };
      emojiDataListeners.forEach((listener) => listener());
      return loadedEmojiData;
    })
    .catch((error) => {
      emojiDataPromise = undefined;
      throw error;
    });

  return emojiDataPromise;
};

export type ShortcodeMapEntry = { key: string; shortcode: string };

export const buildShortcodeMap = (
  imagePacks: ImagePack[],
  unicodeEmojis: Emoji[]
): Map<string, ShortcodeMapEntry> => {
  const map = new Map<string, ShortcodeMapEntry>();

  // Custom emoji packs first (higher priority)
  for (const pack of imagePacks) {
    const images = pack.getImages(ImageUsage.Emoticon);
    for (const image of images) {
      if (!map.has(image.shortcode)) {
        map.set(image.shortcode, { key: image.url, shortcode: image.shortcode });
      }
    }
  }

  // Unicode emojis (lower priority — skip if shortcode already taken)
  for (const emoji of unicodeEmojis) {
    const allShortcodes = emoji.shortcodes ?? [];
    const codes = [emoji.shortcode, ...allShortcodes];
    for (const sc of codes) {
      if (sc && !map.has(sc)) {
        map.set(sc, { key: emoji.unicode, shortcode: sc });
      }
    }
  }

  return map;
};

loadEmojiData().catch(() => undefined);
