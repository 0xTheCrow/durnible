export const GRID_MAX_HEIGHT = 700;
const PAIR_MAX_HEIGHT = 400;
export const WIDE_LAYOUT_MIN_WIDTH = 600;
export const GRID_MIN_WIDTH = 200;
const GRID_GAP = 12;
export const STACK_MAX_WIDTH = 500;
export const MOBILE_STACK_MAX_WIDTH = 400;

export const GRID_MAX_CELLS = 6;

export const MIN_CELL_ASPECT_RATIO = 1 / 2;
export const MAX_CELL_ASPECT_RATIO = 3;

export type Count = 2 | 3 | 4 | 5 | 6;

export const narrowRowSizesForCount: Record<Count, number[]> = {
  2: [1, 1],
  3: [1, 2],
  4: [2, 2],
  5: [1, 2, 2],
  6: [2, 2, 2],
};

export type ImageTile =
  | { type: 'image'; index: number; aspectRatio: number }
  | { type: 'row'; children: ImageTile[] }
  | { type: 'column'; children: ImageTile[] };

type TileWidthForHeight = {
  widthPerHeight: number;
  widthOffset: number;
};

export type ImageCellRect = {
  index: number;
  left: number;
  top: number;
  width: number;
  height: number;
};

export type ImageGridLayout = {
  width: number;
  height: number;
  cells: ImageCellRect[];
};

export const cellAspectRatio = (width?: number, height?: number): number => {
  if (!width || !height) return 1;
  return Math.min(MAX_CELL_ASPECT_RATIO, Math.max(MIN_CELL_ASPECT_RATIO, width / height));
};

const sumOf = (values: number[]): number => values.reduce((total, value) => total + value, 0);

const measureTile = (tile: ImageTile): TileWidthForHeight => {
  if (tile.type === 'image') {
    return { widthPerHeight: tile.aspectRatio, widthOffset: 0 };
  }

  const children = tile.children.map(measureTile);
  const gapTotal = GRID_GAP * (children.length - 1);

  if (tile.type === 'row') {
    return {
      widthPerHeight: sumOf(children.map((child) => child.widthPerHeight)),
      widthOffset: sumOf(children.map((child) => child.widthOffset)) + gapTotal,
    };
  }

  const inverseTotal = sumOf(children.map((child) => 1 / child.widthPerHeight));
  return {
    widthPerHeight: 1 / inverseTotal,
    widthOffset:
      (sumOf(children.map((child) => child.widthOffset / child.widthPerHeight)) - gapTotal) /
      inverseTotal,
  };
};

const tileWidthAtHeight = (tile: ImageTile, height: number): number => {
  const { widthPerHeight, widthOffset } = measureTile(tile);
  return widthPerHeight * height + widthOffset;
};

const tileHeightAtWidth = (tile: ImageTile, width: number): number => {
  const { widthPerHeight, widthOffset } = measureTile(tile);
  return (width - widthOffset) / widthPerHeight;
};

const placeTile = (
  tile: ImageTile,
  left: number,
  top: number,
  width: number,
  height: number,
  cells: ImageCellRect[]
): void => {
  if (tile.type === 'image') {
    cells.push({ index: tile.index, left, top, width, height });
    return;
  }

  if (tile.type === 'row') {
    let childLeft = left;
    tile.children.forEach((child) => {
      const childWidth = tileWidthAtHeight(child, height);
      placeTile(child, childLeft, top, childWidth, height, cells);
      childLeft += childWidth + GRID_GAP;
    });
    return;
  }

  let childTop = top;
  tile.children.forEach((child) => {
    const childHeight = tileHeightAtWidth(child, width);
    placeTile(child, left, childTop, width, childHeight, cells);
    childTop += childHeight + GRID_GAP;
  });
};

const rowOf = (aspectRatios: number[], indexes: number[]): ImageTile => ({
  type: 'row',
  children: indexes.map((index) => ({
    type: 'image' as const,
    index,
    aspectRatio: aspectRatios[index],
  })),
});

export const buildMosaicTile = (aspectRatios: number[]): ImageTile => {
  const leaf = (index: number): ImageTile => ({
    type: 'image',
    index,
    aspectRatio: aspectRatios[index],
  });
  const count = aspectRatios.length as Count;

  switch (count) {
    case 2:
      return rowOf(aspectRatios, [0, 1]);
    case 3:
      return {
        type: 'row',
        children: [leaf(0), { type: 'column', children: [leaf(1), leaf(2)] }],
      };
    case 4:
      return {
        type: 'column',
        children: [rowOf(aspectRatios, [0, 1]), rowOf(aspectRatios, [2, 3])],
      };
    case 5:
      return {
        type: 'row',
        children: [
          leaf(0),
          {
            type: 'column',
            children: [rowOf(aspectRatios, [1, 2]), rowOf(aspectRatios, [3, 4])],
          },
        ],
      };
    case 6:
      return {
        type: 'column',
        children: [rowOf(aspectRatios, [0, 1, 2]), rowOf(aspectRatios, [3, 4, 5])],
      };
    default:
      throw new Error(`Unsupported image grid count: ${count}`);
  }
};

export const buildNarrowTile = (aspectRatios: number[]): ImageTile => {
  const count = aspectRatios.length as Count;
  let nextIndex = 0;
  return {
    type: 'column',
    children: narrowRowSizesForCount[count].map((rowSize) => {
      const indexes = Array.from({ length: rowSize }, (_, offset) => nextIndex + offset);
      nextIndex += rowSize;
      return rowOf(aspectRatios, indexes);
    }),
  };
};

export const maxHeightForCount = (count: Count): number =>
  count === 2 ? PAIR_MAX_HEIGHT : GRID_MAX_HEIGHT;

export const buildImageGridLayout = (
  tile: ImageTile,
  widthBudget: number,
  maxHeight: number
): ImageGridLayout => {
  const height = Math.min(tileHeightAtWidth(tile, widthBudget), maxHeight);
  const width = tileWidthAtHeight(tile, height);
  const cells: ImageCellRect[] = [];
  placeTile(tile, 0, 0, width, height, cells);
  return { width, height, cells };
};

const stackedRowSizes = (count: number, rowCount: number): number[] => {
  const baseSize = Math.floor(count / rowCount);
  const remainder = count % rowCount;
  return Array.from(
    { length: rowCount },
    (_unused, rowIndex) => baseSize + (rowIndex < rowCount - remainder ? 0 : 1)
  );
};

const buildStackedTile = (aspectRatios: number[], rowSizes: number[]): ImageTile => {
  let nextIndex = 0;
  const rows = rowSizes.map((rowSize) => {
    const indexes = Array.from({ length: rowSize }, (_unused, offset) => nextIndex + offset);
    nextIndex += rowSize;
    return rowOf(aspectRatios, indexes);
  });
  return rows.length === 1 ? rows[0] : { type: 'column', children: rows };
};

const buildCandidateTiles = (aspectRatios: number[]): ImageTile[] => {
  const count = aspectRatios.length;
  const stacked = Array.from({ length: count }, (_unused, rowIndex) =>
    buildStackedTile(aspectRatios, stackedRowSizes(count, rowIndex + 1))
  );
  return [buildMosaicTile(aspectRatios), ...stacked];
};

export const chooseImageGridLayout = (
  aspectRatios: number[],
  widthBudget: number,
  maxHeight: number
): ImageGridLayout => {
  const candidates = buildCandidateTiles(aspectRatios).map((tile) => ({
    tile,
    naturalHeight: tileHeightAtWidth(tile, widthBudget),
  }));

  const fillsWidth = candidates.filter((candidate) => candidate.naturalHeight <= maxHeight);
  const chosen = fillsWidth.length
    ? fillsWidth.reduce((tallest, candidate) =>
        candidate.naturalHeight > tallest.naturalHeight ? candidate : tallest
      )
    : candidates.reduce((shortest, candidate) =>
        candidate.naturalHeight < shortest.naturalHeight ? candidate : shortest
      );

  return buildImageGridLayout(chosen.tile, widthBudget, maxHeight);
};
