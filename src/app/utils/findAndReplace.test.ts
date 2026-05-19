import { describe, it, expect } from 'vitest';
import { findAndReplace } from './findAndReplace';

// Helpers to keep test callbacks readable
const toSpan = (match: RegExpExecArray | RegExpMatchArray) => `<match>${match[0]}</match>`;
const toText = (text: string) => text;

describe('findAndReplace', () => {
  it('returns the full text as a single convertPart when there are no matches', () => {
    const result = findAndReplace('hello world', /xyz/g, toSpan, toText);
    expect(result).toEqual(['hello world']);
  });

  it('handles empty text with no matches', () => {
    const result = findAndReplace('', /\d+/g, toSpan, toText);
    expect(result).toEqual(['']);
  });

  it('splits text around a single match', () => {
    const result = findAndReplace('hello 123 world', /\d+/g, toSpan, toText);
    expect(result).toEqual(['hello ', '<match>123</match>', ' world']);
  });

  it('handles a match at the start of the string', () => {
    const result = findAndReplace('123 world', /\d+/g, toSpan, toText);
    expect(result).toEqual(['', '<match>123</match>', ' world']);
  });

  it('handles a match at the end of the string', () => {
    const result = findAndReplace('hello 123', /\d+/g, toSpan, toText);
    expect(result).toEqual(['hello ', '<match>123</match>', '']);
  });

  it('handles multiple matches with text between them', () => {
    const result = findAndReplace('a 1 b 2 c', /\d/g, toSpan, toText);
    expect(result).toEqual(['a ', '<match>1</match>', ' b ', '<match>2</match>', ' c']);
  });

  it('handles consecutive matches', () => {
    const result = findAndReplace('12', /\d/g, toSpan, toText);
    expect(result).toEqual(['', '<match>1</match>', '', '<match>2</match>', '']);
  });

  it('passes the push index to callbacks', () => {
    const indices: number[] = [];
    const result = findAndReplace(
      'a 1 b',
      /\d/g,
      (_, idx) => {
        indices.push(idx);
        return `[${idx}]`;
      },
      (_, idx) => {
        indices.push(idx);
        return `(${idx})`;
      }
    );
    // Callbacks alternate: convertPart('a ', 0), replace('1', 1), convertPart(' b', 2)
    expect(result).toEqual(['(0)', '[1]', '(2)']);
    expect(indices).toEqual([0, 1, 2]);
  });
});
