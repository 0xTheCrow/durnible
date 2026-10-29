import { describe, it, expect } from 'vitest';
import { checkIsAnimatedImageHeader, PNG_SIGNATURE } from './animatedImageHeader';
import {
  buildPngHeader,
  buildSimpleWebpHeader,
  buildWebpVp8xHeader,
} from '../../test/imageHeaderFixtures';

describe('checkIsAnimatedImageHeader', () => {
  describe('WebP', () => {
    it('detects a VP8X header with the animation flag set', () => {
      expect(checkIsAnimatedImageHeader(buildWebpVp8xHeader(true))).toBe(true);
    });

    it('treats a VP8X header without the animation flag as static', () => {
      expect(checkIsAnimatedImageHeader(buildWebpVp8xHeader(false))).toBe(false);
    });

    it('treats a simple VP8 file as static', () => {
      expect(checkIsAnimatedImageHeader(buildSimpleWebpHeader())).toBe(false);
    });
  });

  describe('PNG', () => {
    it('detects acTL before IDAT', () => {
      const header = buildPngHeader([
        { type: 'IHDR', dataLength: 13 },
        { type: 'acTL', dataLength: 8 },
        { type: 'IDAT', dataLength: 4 },
      ]);
      expect(checkIsAnimatedImageHeader(header)).toBe(true);
    });

    it('treats a PNG with no acTL as static', () => {
      const header = buildPngHeader([
        { type: 'IHDR', dataLength: 13 },
        { type: 'IDAT', dataLength: 4 },
      ]);
      expect(checkIsAnimatedImageHeader(header)).toBe(false);
    });

    it('finds acTL past a preceding iCCP chunk', () => {
      const header = buildPngHeader([
        { type: 'IHDR', dataLength: 13 },
        { type: 'iCCP', dataLength: 3000 },
        { type: 'acTL', dataLength: 8 },
        { type: 'IDAT', dataLength: 4 },
      ]);
      expect(checkIsAnimatedImageHeader(header)).toBe(true);
    });

    it('returns false for a buffer cut off inside a chunk header', () => {
      const header = new Uint8Array([...PNG_SIGNATURE, 0, 0, 0, 13, 0x49, 0x48]);
      expect(checkIsAnimatedImageHeader(header)).toBe(false);
    });
  });
});
