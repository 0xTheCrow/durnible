import { describe, it, expect } from 'vitest';
import { getScreenSize, ScreenSize, TABLET_BREAKPOINT, MOBILE_BREAKPOINT } from './useScreenSize';

describe('getScreenSize', () => {
  it('returns Desktop for widths above the tablet breakpoint', () => {
    expect(getScreenSize(TABLET_BREAKPOINT + 1)).toBe(ScreenSize.Desktop);
    expect(getScreenSize(1920)).toBe(ScreenSize.Desktop);
  });

  it('returns Tablet at exactly the tablet breakpoint', () => {
    expect(getScreenSize(TABLET_BREAKPOINT)).toBe(ScreenSize.Tablet);
  });

  it('returns Tablet for widths between mobile and tablet breakpoints', () => {
    expect(getScreenSize(MOBILE_BREAKPOINT + 1)).toBe(ScreenSize.Tablet);
    expect(getScreenSize(900)).toBe(ScreenSize.Tablet);
  });

  it('returns Mobile at exactly the mobile breakpoint', () => {
    expect(getScreenSize(MOBILE_BREAKPOINT)).toBe(ScreenSize.Mobile);
  });

  it('returns Mobile for widths below the mobile breakpoint', () => {
    expect(getScreenSize(MOBILE_BREAKPOINT - 1)).toBe(ScreenSize.Mobile);
    expect(getScreenSize(0)).toBe(ScreenSize.Mobile);
  });
});
