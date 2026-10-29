export const ANIMATED_IMAGE_HEADER_BYTE_COUNT = 64 * 1024;

export const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
const PNG_CHUNK_OVERHEAD_BYTES = 12;
export const WEBP_ANIMATION_FLAG = 0x02;
const WEBP_VP8X_FLAGS_OFFSET = 20;

const readAscii = (bytes: Uint8Array, offset: number, length: number): string =>
  String.fromCharCode(...bytes.subarray(offset, offset + length));

const checkIsAnimatedWebp = (bytes: Uint8Array): boolean =>
  bytes.length > WEBP_VP8X_FLAGS_OFFSET &&
  readAscii(bytes, 0, 4) === 'RIFF' &&
  readAscii(bytes, 8, 4) === 'WEBP' &&
  readAscii(bytes, 12, 4) === 'VP8X' &&
  (bytes[WEBP_VP8X_FLAGS_OFFSET] & WEBP_ANIMATION_FLAG) !== 0;

const checkIsAnimatedPng = (bytes: Uint8Array): boolean => {
  if (!PNG_SIGNATURE.every((byte, i) => bytes[i] === byte)) return false;
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let offset = PNG_SIGNATURE.length;
  while (offset + 8 <= bytes.length) {
    const chunkType = readAscii(bytes, offset + 4, 4);
    if (chunkType === 'acTL') return true;
    if (chunkType === 'IDAT') return false;
    offset += PNG_CHUNK_OVERHEAD_BYTES + view.getUint32(offset);
  }
  return false;
};

export const checkIsAnimatedImageHeader = (bytes: Uint8Array): boolean =>
  checkIsAnimatedWebp(bytes) || checkIsAnimatedPng(bytes);
