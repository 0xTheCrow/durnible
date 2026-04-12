import { describe, it, expect } from 'vitest';
import {
  bytesToSize,
  millisecondsToMinutesAndSeconds,
  secondsToMinutesAndSeconds,
  binarySearch,
  parseGeoUri,
  nameInitials,
  splitWithSpace,
  fulfilledPromiseSettledResult,
  suffixRename,
} from './common';

describe('bytesToSize', () => {
  it('returns 0KB for zero bytes', () => {
    expect(bytesToSize(0)).toBe('0KB');
  });

  it('formats bytes under 1KB as KB', () => {
    expect(bytesToSize(1)).toBe('0.0 KB');
    expect(bytesToSize(500)).toBe('0.5 KB');
    expect(bytesToSize(999)).toBe('1.0 KB');
  });

  it('formats kilobytes', () => {
    expect(bytesToSize(1000)).toBe('1.0 KB');
    expect(bytesToSize(1500)).toBe('1.5 KB');
  });

  it('formats megabytes', () => {
    expect(bytesToSize(1_000_000)).toBe('1.0 MB');
    expect(bytesToSize(1_500_000)).toBe('1.5 MB');
  });

  it('formats gigabytes', () => {
    expect(bytesToSize(1_000_000_000)).toBe('1.0 GB');
  });
});

describe('millisecondsToMinutesAndSeconds', () => {
  it('formats zero', () => {
    expect(millisecondsToMinutesAndSeconds(0)).toBe('0:00');
  });

  it('pads seconds below 10', () => {
    expect(millisecondsToMinutesAndSeconds(1000)).toBe('0:01');
    expect(millisecondsToMinutesAndSeconds(9000)).toBe('0:09');
  });

  it('does not pad seconds 10 and above', () => {
    expect(millisecondsToMinutesAndSeconds(10000)).toBe('0:10');
    expect(millisecondsToMinutesAndSeconds(59000)).toBe('0:59');
  });

  it('handles whole minutes', () => {
    expect(millisecondsToMinutesAndSeconds(60000)).toBe('1:00');
    expect(millisecondsToMinutesAndSeconds(3600000)).toBe('60:00');
  });

  it('handles minutes and seconds', () => {
    expect(millisecondsToMinutesAndSeconds(61000)).toBe('1:01');
    expect(millisecondsToMinutesAndSeconds(90000)).toBe('1:30');
  });
});

describe('secondsToMinutesAndSeconds', () => {
  it('formats zero', () => {
    expect(secondsToMinutesAndSeconds(0)).toBe('0:00');
  });

  it('pads seconds below 10', () => {
    expect(secondsToMinutesAndSeconds(1)).toBe('0:01');
  });

  it('handles minutes and seconds', () => {
    expect(secondsToMinutesAndSeconds(90)).toBe('1:30');
    expect(secondsToMinutesAndSeconds(60)).toBe('1:00');
  });
});

describe('binarySearch', () => {
  const nums = [1, 3, 5, 7, 9];

  it('finds an element in the middle', () => {
    expect(binarySearch(nums, (n) => (n === 5 ? 0 : n > 5 ? 1 : -1))).toBe(5);
  });

  it('finds the first element', () => {
    expect(binarySearch(nums, (n) => (n === 1 ? 0 : n > 1 ? 1 : -1))).toBe(1);
  });

  it('finds the last element', () => {
    expect(binarySearch(nums, (n) => (n === 9 ? 0 : n > 9 ? 1 : -1))).toBe(9);
  });

  it('returns undefined when not found', () => {
    expect(binarySearch(nums, () => -1)).toBeUndefined();
  });

  it('returns undefined for empty array', () => {
    expect(binarySearch([], () => 0)).toBeUndefined();
  });
});

describe('parseGeoUri', () => {
  it('parses latitude and longitude', () => {
    expect(parseGeoUri('geo:51.5074,-0.1278')).toEqual({
      latitude: '51.5074',
      longitude: '-0.1278',
    });
  });
});

describe('nameInitials', () => {
  it('returns first character by default', () => {
    expect(nameInitials('Alice')).toBe('A');
  });

  it('returns specified number of characters', () => {
    expect(nameInitials('Alice', 2)).toBe('Al');
    expect(nameInitials('Alice', 3)).toBe('Ali');
  });

  it('returns replacement character for falsy input', () => {
    expect(nameInitials(null)).toBeTruthy();
    expect(nameInitials(undefined)).toBeTruthy();
    expect(nameInitials('')).toBeTruthy();
  });
});

describe('splitWithSpace', () => {
  it('splits on spaces', () => {
    expect(splitWithSpace('hello world')).toEqual(['hello', 'world']);
  });

  it('returns empty array for empty or whitespace-only string', () => {
    expect(splitWithSpace('')).toEqual([]);
    expect(splitWithSpace('   ')).toEqual([]);
  });

  it('trims surrounding spaces before splitting', () => {
    expect(splitWithSpace('  hello world  ')).toEqual(['hello', 'world']);
  });
});

describe('suffixRename', () => {
  it('appends suffix 1 when no conflict', () => {
    expect(suffixRename('foo', () => false)).toBe('foo1');
  });

  it('increments suffix until no conflict', () => {
    const existing = new Set(['foo1', 'foo2']);
    expect(suffixRename('foo', (name) => existing.has(name))).toBe('foo3');
  });
});

describe('fulfilledPromiseSettledResult', () => {
  it('returns values from fulfilled results only', () => {
    const results: PromiseSettledResult<number>[] = [
      { status: 'fulfilled', value: 1 },
      { status: 'rejected', reason: 'err' },
      { status: 'fulfilled', value: 3 },
    ];
    expect(fulfilledPromiseSettledResult(results)).toEqual([1, 3]);
  });

  it('returns empty array when all are rejected', () => {
    const results: PromiseSettledResult<number>[] = [{ status: 'rejected', reason: 'err' }];
    expect(fulfilledPromiseSettledResult(results)).toEqual([]);
  });
});
