import { describe, it, expect } from 'vitest';
import { getVideoDisplayDimensions, getVideoRotationDegrees } from './mp4VideoTrack';

const FIXED_POINT_ONE = 0x10000;
const IDENTITY_MATRIX = [FIXED_POINT_ONE, 0, 0, FIXED_POINT_ONE];
const ROTATE_90_MATRIX = [0, FIXED_POINT_ONE, -FIXED_POINT_ONE, 0];
const ROTATE_180_MATRIX = [-FIXED_POINT_ONE, 0, 0, -FIXED_POINT_ONE];
const ROTATE_270_MATRIX = [0, -FIXED_POINT_ONE, FIXED_POINT_ONE, 0];
const MIRRORED_MATRIX = [-FIXED_POINT_ONE, 0, 0, FIXED_POINT_ONE];

const concatenate = (parts: number[][]): number[] => ([] as number[]).concat(...parts);

const zeros = (length: number): number[] => new Array(length).fill(0);

const uint32 = (value: number): number[] => [
  (value >>> 24) & 0xff,
  (value >>> 16) & 0xff,
  (value >>> 8) & 0xff,
  value & 0xff,
];

const fourCharacterCode = (type: string): number[] =>
  Array.from(type, (character) => character.charCodeAt(0));

const box = (type: string, ...bodyParts: number[][]): number[] => {
  const body = concatenate(bodyParts);
  return [...uint32(8 + body.length), ...fourCharacterCode(type), ...body];
};

const largeBox = (type: string, ...bodyParts: number[][]): number[] => {
  const body = concatenate(bodyParts);
  return [
    ...uint32(1),
    ...fourCharacterCode(type),
    ...uint32(0),
    ...uint32(16 + body.length),
    ...body,
  ];
};

type TrackDimensions = { width: number; height: number };

const NO_DIMENSIONS: TrackDimensions = { width: 0, height: 0 };

const matrixBytes = (rotationPart: number[]): number[] => {
  const [a, b, c, d] = rotationPart;
  return concatenate([a, b, 0, c, d, 0, 0, 0, 0x40000000].map(uint32));
};

const trackHeader = (
  rotationPart: number[],
  version: 0 | 1 = 0,
  dimensions: TrackDimensions = NO_DIMENSIONS
): number[] => {
  const bytesBeforeMatrix = version === 1 ? 48 : 36;
  return box(
    'tkhd',
    [version, 0, 0, 0],
    zeros(bytesBeforeMatrix),
    matrixBytes(rotationPart),
    uint32(dimensions.width * FIXED_POINT_ONE),
    uint32(dimensions.height * FIXED_POINT_ONE)
  );
};

const handler = (handlerType: string): number[] =>
  box('hdlr', zeros(4), zeros(4), fourCharacterCode(handlerType), zeros(12), [0]);

const track = (
  handlerType: string,
  rotationPart: number[],
  version: 0 | 1 = 0,
  dimensions: TrackDimensions = NO_DIMENSIONS
): number[] =>
  box('trak', trackHeader(rotationPart, version, dimensions), box('mdia', handler(handlerType)));

const toFile = (...topLevelBoxes: number[][]): Blob =>
  new Blob([new Uint8Array(concatenate(topLevelBoxes))]);

const FILE_TYPE_BOX = box('ftyp', fourCharacterCode('isom'), zeros(4));

describe('getVideoRotationDegrees', () => {
  it.each([
    [0, IDENTITY_MATRIX],
    [90, ROTATE_90_MATRIX],
    [180, ROTATE_180_MATRIX],
    [270, ROTATE_270_MATRIX],
  ])('reads %i degrees from the video track header', async (rotationDegrees, rotationPart) => {
    const videoFile = toFile(FILE_TYPE_BOX, box('moov', track('vide', rotationPart)));

    expect(await getVideoRotationDegrees(videoFile)).toBe(rotationDegrees);
  });

  it('reads a version 1 track header', async () => {
    const videoFile = toFile(FILE_TYPE_BOX, box('moov', track('vide', ROTATE_90_MATRIX, 1)));

    expect(await getVideoRotationDegrees(videoFile)).toBe(90);
  });

  it('uses the video track when an audio track comes first', async () => {
    const videoFile = toFile(
      FILE_TYPE_BOX,
      box('moov', track('soun', ROTATE_180_MATRIX), track('vide', ROTATE_270_MATRIX))
    );

    expect(await getVideoRotationDegrees(videoFile)).toBe(270);
  });

  it('finds the movie box after a media box with a 64-bit size', async () => {
    const videoFile = toFile(
      FILE_TYPE_BOX,
      largeBox('mdat', zeros(5000)),
      box('moov', track('vide', ROTATE_90_MATRIX))
    );

    expect(await getVideoRotationDegrees(videoFile)).toBe(90);
  });

  it('returns 0 when the file has no movie box', async () => {
    const webmHeader = [0x1a, 0x45, 0xdf, 0xa3, 0x9f, 0x42, 0x86, 0x81, 0x01];

    expect(await getVideoRotationDegrees(toFile(webmHeader, zeros(64)))).toBe(0);
  });

  it('returns 0 for a mirrored matrix', async () => {
    const videoFile = toFile(FILE_TYPE_BOX, box('moov', track('vide', MIRRORED_MATRIX)));

    expect(await getVideoRotationDegrees(videoFile)).toBe(0);
  });

  it('returns 0 when a box claims to extend past the end of the file', async () => {
    const movieBox = box('moov', track('vide', ROTATE_90_MATRIX));
    const truncatedMovieBox = movieBox.slice(0, movieBox.length - 20);

    expect(await getVideoRotationDegrees(toFile(FILE_TYPE_BOX, truncatedMovieBox))).toBe(0);
  });

  it('returns 0 when the track header is too short to hold a matrix', async () => {
    const shortTrackHeader = box('tkhd', [0, 0, 0, 0], zeros(10));
    const videoFile = toFile(
      FILE_TYPE_BOX,
      box('moov', box('trak', shortTrackHeader, box('mdia', handler('vide'))))
    );

    expect(await getVideoRotationDegrees(videoFile)).toBe(0);
  });
});

describe('getVideoDisplayDimensions', () => {
  const STORED_DIMENSIONS: TrackDimensions = { width: 1920, height: 1080 };
  const SWAPPED_DIMENSIONS: TrackDimensions = { width: 1080, height: 1920 };

  it.each([
    [0, IDENTITY_MATRIX, STORED_DIMENSIONS],
    [90, ROTATE_90_MATRIX, SWAPPED_DIMENSIONS],
    [180, ROTATE_180_MATRIX, STORED_DIMENSIONS],
    [270, ROTATE_270_MATRIX, SWAPPED_DIMENSIONS],
  ])(
    'reports the displayed size of a track rotated %i degrees',
    async (_rotationDegrees, rotationPart, displayedDimensions) => {
      const videoFile = toFile(
        FILE_TYPE_BOX,
        box('moov', track('vide', rotationPart, 0, STORED_DIMENSIONS))
      );

      expect(await getVideoDisplayDimensions(videoFile)).toEqual(displayedDimensions);
    }
  );

  it('reads the size from a version 1 track header', async () => {
    const videoFile = toFile(
      FILE_TYPE_BOX,
      box('moov', track('vide', IDENTITY_MATRIX, 1, STORED_DIMENSIONS))
    );

    expect(await getVideoDisplayDimensions(videoFile)).toEqual(STORED_DIMENSIONS);
  });

  it('returns undefined when the track header declares a zero size', async () => {
    const videoFile = toFile(FILE_TYPE_BOX, box('moov', track('vide', IDENTITY_MATRIX)));

    expect(await getVideoDisplayDimensions(videoFile)).toBeUndefined();
  });

  it('returns undefined when the track header ends before the size', async () => {
    const trackHeaderWithoutSize = box(
      'tkhd',
      [0, 0, 0, 0],
      zeros(36),
      matrixBytes(IDENTITY_MATRIX)
    );
    const videoFile = toFile(
      FILE_TYPE_BOX,
      box('moov', box('trak', trackHeaderWithoutSize, box('mdia', handler('vide'))))
    );

    expect(await getVideoDisplayDimensions(videoFile)).toBeUndefined();
  });
});
