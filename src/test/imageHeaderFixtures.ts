import { PNG_SIGNATURE, WEBP_ANIMATION_FLAG } from '../app/utils/animatedImageHeader';

const asciiBytes = (text: string): number[] =>
  Array.from(text, (character) => character.charCodeAt(0));

const uint32BigEndianBytes = (value: number): number[] => [
  (value >>> 24) & 0xff,
  (value >>> 16) & 0xff,
  (value >>> 8) & 0xff,
  value & 0xff,
];

const RIFF_SIZE_PLACEHOLDER = [0, 0, 0, 0];
const VP8X_CHUNK_SIZE = [10, 0, 0, 0];
const VP8X_RESERVED_AND_CANVAS_SIZE = [0, 0, 0, 0, 0, 0, 0, 0, 0];

export const buildWebpVp8xHeader = (isAnimated: boolean): Uint8Array =>
  new Uint8Array([
    ...asciiBytes('RIFF'),
    ...RIFF_SIZE_PLACEHOLDER,
    ...asciiBytes('WEBP'),
    ...asciiBytes('VP8X'),
    ...VP8X_CHUNK_SIZE,
    isAnimated ? WEBP_ANIMATION_FLAG : 0,
    ...VP8X_RESERVED_AND_CANVAS_SIZE,
  ]);

export const buildSimpleWebpHeader = (): Uint8Array =>
  new Uint8Array([
    ...asciiBytes('RIFF'),
    ...RIFF_SIZE_PLACEHOLDER,
    ...asciiBytes('WEBP'),
    ...asciiBytes('VP8 '),
    ...new Array(16).fill(0),
  ]);

export type PngChunkFixture = { type: string; dataLength: number };

export const buildPngHeader = (chunks: PngChunkFixture[]): Uint8Array =>
  new Uint8Array([
    ...PNG_SIGNATURE,
    ...chunks.flatMap(({ type, dataLength }) => [
      ...uint32BigEndianBytes(dataLength),
      ...asciiBytes(type),
      ...new Array(dataLength).fill(0),
      ...uint32BigEndianBytes(0),
    ]),
  ]);
