import { describe, it, expect } from 'vitest';
import { scaleSystemEmoji } from './react-custom-html-parser';

const wrappedEmojis = (parts: (string | JSX.Element)[]): string[] =>
  parts
    .filter((part): part is JSX.Element => typeof part !== 'string')
    .map((element) => element.props.children);

describe('scaleSystemEmoji', () => {
  it('wraps stock emojis and leaves surrounding text unwrapped', () => {
    const parts = scaleSystemEmoji('age: 😀 7');
    expect(wrappedEmojis(parts)).toEqual(['😀']);
    expect(parts.filter((part) => typeof part === 'string')).toEqual(['age: ', ' 7']);
  });

  it('wraps Emoji 16.0 characters', () => {
    expect(wrappedEmojis(scaleSystemEmoji('🫩'))).toEqual(['🫩']);
  });

  it('does not wrap emojis inside URLs', () => {
    const parts = scaleSystemEmoji('https://example.test/😀');
    expect(wrappedEmojis(parts)).toEqual([]);
  });
});
