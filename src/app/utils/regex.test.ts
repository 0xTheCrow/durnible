import { describe, it, expect } from 'vitest';
import { isJumboEmoji, MAX_JUMBO_EMOJI_COUNT } from './regex';

describe('isJumboEmoji', () => {
  it.each([
    ['single stock emoji', '😀'],
    ['ZWJ sequence', '🏳️‍🌈'],
    ['skin tone sequence', '👍🏽'],
    ['flag pair', '🇺🇸'],
    ['keycap', '#️⃣'],
    ['Emoji 16.0 character', '🫩'],
    ['custom emoji shortcode', ':party:'],
    ['mixed stock and shortcode', '😀 :party:'],
    ['emojis at the count cap', '😀'.repeat(MAX_JUMBO_EMOJI_COUNT)],
  ])('is true for %s', (_label, text) => {
    expect(isJumboEmoji(text)).toBe(true);
  });

  it.each([
    ['text mixed with emoji', 'hello 😀'],
    ['emojis over the count cap', '😀'.repeat(MAX_JUMBO_EMOJI_COUNT + 1)],
    ['a bare digit', '7'],
    ['only zero-width characters', '​‌'],
  ])('is false for %s', (_label, text) => {
    expect(isJumboEmoji(text)).toBe(false);
  });
});
