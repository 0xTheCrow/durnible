/**
 * https://www.npmjs.com/package/escape-string-regexp
 */
export const sanitizeForRegex = (unsafeText: string): string =>
  unsafeText.replace(/[|\\{}()[\]^$+*?.]/g, '\\$&').replace(/-/g, '\\x2d');

export const HTTP_URL_PATTERN = `https?:\\/\\/(?:www\\.)?(?:[^\\s)]*)(?<![.,:;!/?()[\\]\\s]+)`;

export const URL_REG = new RegExp(HTTP_URL_PATTERN, 'g');

export const EMAIL_REGEX =
  /^(([^<>()[\]\\.,;:\s@\\"]+(\.[^<>()[\]\\.,;:\s@\\"]+)*)|(\\".+\\"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/;

export const URL_NEG_LB = '(?<!(https?|ftp|mailto|magnet):\\/\\/\\S*)';

// https://en.wikipedia.org/wiki/Variation_Selectors_(Unicode_block)
export const VARIATION_SELECTOR_PATTERN = '[\uFE00-\uFE0F]';

const TAG_SEQUENCE_PATTERN =
  '\\p{Extended_Pictographic}(?:\\p{Emoji_Modifier}|\\uFE0F)?[\\u{E0020}-\\u{E007E}]+\\u{E007F}';
const FLAG_PATTERN = '\\p{Regional_Indicator}{1,2}';
const KEYCAP_PATTERN = '[#*0-9]\\uFE0F?\\u20E3';
const PICTOGRAPHIC_PATTERN = '\\p{Extended_Pictographic}(?:\\uFE0F?\\p{Emoji_Modifier}|\\uFE0F)?';
const SKIN_TONE_PATTERN = '\\p{Emoji_Modifier}';
const EMOJI_UNIT_PATTERN = `(?:${TAG_SEQUENCE_PATTERN}|${FLAG_PATTERN}|${KEYCAP_PATTERN}|${PICTOGRAPHIC_PATTERN}|${SKIN_TONE_PATTERN})`;

export const EMOJI_PATTERN = `${EMOJI_UNIT_PATTERN}(?:\\u200D${EMOJI_UNIT_PATTERN})*`;

export const MAX_JUMBO_EMOJI_COUNT = 10;

// Thumbs up emoji found to have Variation Selector 16 at the end
// so included variation selector pattern in regex
export const JUMBO_EMOJI_REG = new RegExp(
  `^(((${EMOJI_PATTERN})|(:.+?:))(${VARIATION_SELECTOR_PATTERN}|\\s)*){1,${MAX_JUMBO_EMOJI_COUNT}}$`,
  'u'
);

const ZERO_WIDTH_FORMAT_REG = /[\u200B\u200C\u2060\uFEFF]/g;

export const isJumboEmoji = (text: string): boolean =>
  JUMBO_EMOJI_REG.test(text.replace(ZERO_WIDTH_FORMAT_REG, '').trim());
