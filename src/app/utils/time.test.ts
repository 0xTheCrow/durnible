import { describe, it, expect } from 'vitest';
import {
  inSameDay,
  minuteDifference,
  hour24to12,
  hour12to24,
  daysToMs,
  today,
  yesterday,
} from './time';

describe('inSameDay', () => {
  it('returns true for two timestamps in the same day', () => {
    const base = new Date('2024-01-15T10:00:00').getTime();
    const later = new Date('2024-01-15T23:59:59').getTime();
    expect(inSameDay(base, later)).toBe(true);
  });

  it('returns false for timestamps on different days', () => {
    const day1 = new Date('2024-01-15T23:59:59').getTime();
    const day2 = new Date('2024-01-16T00:00:00').getTime();
    expect(inSameDay(day1, day2)).toBe(false);
  });

  it('returns true for identical timestamps', () => {
    const ts = new Date('2024-06-01T12:00:00').getTime();
    expect(inSameDay(ts, ts)).toBe(true);
  });
});

describe('minuteDifference', () => {
  it('returns 0 for identical timestamps', () => {
    const ts = Date.now();
    expect(minuteDifference(ts, ts)).toBe(0);
  });

  it('returns 1 for 60 seconds apart', () => {
    const ts = Date.now();
    expect(minuteDifference(ts, ts + 60_000)).toBe(1);
  });

  it('is order-independent (absolute value)', () => {
    const ts = Date.now();
    expect(minuteDifference(ts + 60_000, ts)).toBe(1);
    expect(minuteDifference(ts, ts + 60_000)).toBe(1);
  });

  it('rounds to nearest minute', () => {
    const ts = Date.now();
    expect(minuteDifference(ts, ts + 90_000)).toBe(2); // 1.5 min → rounds to 2
    expect(minuteDifference(ts, ts + 89_000)).toBe(1); // ~1.48 min → rounds to 1
  });
});

describe('hour24to12', () => {
  it('converts midnight (0) to 12', () => {
    expect(hour24to12(0)).toBe(12);
  });

  it('converts noon (12) to 12', () => {
    expect(hour24to12(12)).toBe(12);
  });

  it('converts afternoon hours', () => {
    expect(hour24to12(13)).toBe(1);
    expect(hour24to12(23)).toBe(11);
  });

  it('passes through morning hours 1–11 unchanged', () => {
    expect(hour24to12(1)).toBe(1);
    expect(hour24to12(11)).toBe(11);
  });
});

describe('hour12to24', () => {
  it('converts 12 AM to 0', () => {
    expect(hour12to24(12, false)).toBe(0);
  });

  it('converts 12 PM to 12', () => {
    expect(hour12to24(12, true)).toBe(12);
  });

  it('converts AM hours correctly', () => {
    expect(hour12to24(1, false)).toBe(1);
    expect(hour12to24(11, false)).toBe(11);
  });

  it('converts PM hours correctly', () => {
    expect(hour12to24(1, true)).toBe(13);
    expect(hour12to24(11, true)).toBe(23);
  });
});

describe('today / yesterday', () => {
  it('today returns true for current timestamp', () => {
    expect(today(Date.now())).toBe(true);
  });

  it('today returns false for yesterday', () => {
    expect(today(Date.now() - daysToMs(1))).toBe(false);
  });

  it('yesterday returns true for yesterday timestamp', () => {
    expect(yesterday(Date.now() - daysToMs(1))).toBe(true);
  });

  it('yesterday returns false for today', () => {
    expect(yesterday(Date.now())).toBe(false);
  });
});
