export type VideoRotationDegrees = 0 | 90 | 180 | 270;

export type VideoDimensions = {
  width: number;
  height: number;
};

type VideoTrackHeader = VideoDimensions & {
  rotationDegrees: VideoRotationDegrees;
};

type Mp4Box = {
  type: string;
  bodyStart: number;
  end: number;
};

const COMPACT_BOX_HEADER_BYTES = 8;
const LARGE_BOX_HEADER_BYTES = 16;
const HANDLER_TYPE_OFFSET = 8;
const TRACK_HEADER_MATRIX_OFFSET_VERSION_0 = 40;
const TRACK_HEADER_MATRIX_OFFSET_VERSION_1 = 52;
const MATRIX_BYTES = 36;
const DIMENSIONS_BYTES = 8;
const FIXED_POINT_ONE = 0x10000;

const ROTATION_MATRICES: { rotationDegrees: VideoRotationDegrees; matrix: number[] }[] = [
  { rotationDegrees: 0, matrix: [FIXED_POINT_ONE, 0, 0, FIXED_POINT_ONE] },
  { rotationDegrees: 90, matrix: [0, FIXED_POINT_ONE, -FIXED_POINT_ONE, 0] },
  { rotationDegrees: 180, matrix: [-FIXED_POINT_ONE, 0, 0, -FIXED_POINT_ONE] },
  { rotationDegrees: 270, matrix: [0, -FIXED_POINT_ONE, FIXED_POINT_ONE, 0] },
];

const readFourCharacterCode = (view: DataView, offset: number): string =>
  String.fromCharCode(
    view.getUint8(offset),
    view.getUint8(offset + 1),
    view.getUint8(offset + 2),
    view.getUint8(offset + 3)
  );

const parseBoxAt = (view: DataView, offset: number, availableBytes: number): Mp4Box | undefined => {
  if (offset + COMPACT_BOX_HEADER_BYTES > view.byteLength) return undefined;
  const compactSize = view.getUint32(offset);
  const type = readFourCharacterCode(view, offset + 4);

  let headerBytes = COMPACT_BOX_HEADER_BYTES;
  let size = compactSize;
  if (compactSize === 1) {
    if (offset + LARGE_BOX_HEADER_BYTES > view.byteLength) return undefined;
    headerBytes = LARGE_BOX_HEADER_BYTES;
    size = view.getUint32(offset + 8) * 2 ** 32 + view.getUint32(offset + 12);
  } else if (compactSize === 0) {
    size = availableBytes;
  }

  if (size < headerBytes || size > availableBytes) return undefined;
  return { type, bodyStart: offset + headerBytes, end: offset + size };
};

const readChildBoxes = (view: DataView, start: number, end: number): Mp4Box[] => {
  const boxes: Mp4Box[] = [];
  let offset = start;
  while (offset < end) {
    const box = parseBoxAt(view, offset, end - offset);
    if (!box) break;
    boxes.push(box);
    offset = box.end;
  }
  return boxes;
};

const findChildBox = (view: DataView, parent: Mp4Box, type: string): Mp4Box | undefined =>
  readChildBoxes(view, parent.bodyStart, parent.end).find((box) => box.type === type);

const readMovieBox = async (videoFile: Blob): Promise<DataView | undefined> => {
  let fileOffset = 0;
  while (fileOffset < videoFile.size) {
    const headerView = new DataView(
      await videoFile.slice(fileOffset, fileOffset + LARGE_BOX_HEADER_BYTES).arrayBuffer()
    );
    const box = parseBoxAt(headerView, 0, videoFile.size - fileOffset);
    if (!box) return undefined;
    if (box.type === 'moov') {
      return new DataView(
        await videoFile.slice(fileOffset + box.bodyStart, fileOffset + box.end).arrayBuffer()
      );
    }
    fileOffset += box.end;
  }
  return undefined;
};

const checkIsVideoTrack = (view: DataView, trackBox: Mp4Box): boolean => {
  const mediaBox = findChildBox(view, trackBox, 'mdia');
  const handlerBox = mediaBox && findChildBox(view, mediaBox, 'hdlr');
  if (!handlerBox || handlerBox.bodyStart + HANDLER_TYPE_OFFSET + 4 > handlerBox.end) return false;
  return readFourCharacterCode(view, handlerBox.bodyStart + HANDLER_TYPE_OFFSET) === 'vide';
};

export const checkIsQuarterTurn = (rotationDegrees: VideoRotationDegrees): boolean =>
  rotationDegrees === 90 || rotationDegrees === 270;

const readRotationDegrees = (view: DataView, matrixStart: number): VideoRotationDegrees => {
  const rotationPart = [
    view.getInt32(matrixStart),
    view.getInt32(matrixStart + 4),
    view.getInt32(matrixStart + 12),
    view.getInt32(matrixStart + 16),
  ];
  const matchingRotation = ROTATION_MATRICES.find(({ matrix }) =>
    matrix.every((value, index) => value === rotationPart[index])
  );
  return matchingRotation?.rotationDegrees ?? 0;
};

const readFixedPointInteger = (view: DataView, offset: number): number =>
  Math.round(view.getUint32(offset) / FIXED_POINT_ONE);

const parseTrackHeader = (view: DataView, trackHeaderBox: Mp4Box): VideoTrackHeader => {
  const emptyTrackHeader: VideoTrackHeader = { rotationDegrees: 0, width: 0, height: 0 };
  if (trackHeaderBox.bodyStart >= trackHeaderBox.end) return emptyTrackHeader;
  const version = view.getUint8(trackHeaderBox.bodyStart);
  const matrixStart =
    trackHeaderBox.bodyStart +
    (version === 1 ? TRACK_HEADER_MATRIX_OFFSET_VERSION_1 : TRACK_HEADER_MATRIX_OFFSET_VERSION_0);
  if (matrixStart + MATRIX_BYTES > trackHeaderBox.end) return emptyTrackHeader;

  const rotationDegrees = readRotationDegrees(view, matrixStart);
  const dimensionsStart = matrixStart + MATRIX_BYTES;
  if (dimensionsStart + DIMENSIONS_BYTES > trackHeaderBox.end) {
    return { ...emptyTrackHeader, rotationDegrees };
  }
  return {
    rotationDegrees,
    width: readFixedPointInteger(view, dimensionsStart),
    height: readFixedPointInteger(view, dimensionsStart + 4),
  };
};

const readVideoTrackHeader = async (videoFile: Blob): Promise<VideoTrackHeader | undefined> => {
  const movieView = await readMovieBox(videoFile);
  if (!movieView) return undefined;

  const videoTrackBox = readChildBoxes(movieView, 0, movieView.byteLength)
    .filter((box) => box.type === 'trak')
    .find((trackBox) => checkIsVideoTrack(movieView, trackBox));
  const trackHeaderBox = videoTrackBox && findChildBox(movieView, videoTrackBox, 'tkhd');
  return trackHeaderBox && parseTrackHeader(movieView, trackHeaderBox);
};

export const getVideoRotationDegrees = async (videoFile: Blob): Promise<VideoRotationDegrees> =>
  (await readVideoTrackHeader(videoFile))?.rotationDegrees ?? 0;

export const getVideoDisplayDimensions = async (
  videoFile: Blob
): Promise<VideoDimensions | undefined> => {
  const trackHeader = await readVideoTrackHeader(videoFile);
  if (!trackHeader || trackHeader.width === 0 || trackHeader.height === 0) return undefined;
  const { width, height, rotationDegrees } = trackHeader;
  return checkIsQuarterTurn(rotationDegrees) ? { width: height, height: width } : { width, height };
};
