import { describe, it, expect } from 'vitest';
import type { Count, ImageCellRect, ImageGridLayout, ImageTile } from './imageGridLayout';
import {
  GRID_MAX_HEIGHT,
  MAX_CELL_ASPECT_RATIO,
  MIN_CELL_ASPECT_RATIO,
  buildImageGridLayout,
  buildMosaicTile,
  buildNarrowTile,
  cellAspectRatio,
  maxHeightForCount,
  narrowRowSizesForCount,
} from './imageGridLayout';

const COUNTS: Count[] = [2, 3, 4, 5, 6];

const LANDSCAPE = 16 / 9;
const PORTRAIT = 9 / 16;
const SQUARE = 1;

const ASPECT_RATIO_MIXES: Record<string, number[]> = {
  landscape: [LANDSCAPE, LANDSCAPE, LANDSCAPE, LANDSCAPE, LANDSCAPE, LANDSCAPE],
  portrait: [PORTRAIT, PORTRAIT, PORTRAIT, PORTRAIT, PORTRAIT, PORTRAIT],
  square: [SQUARE, SQUARE, SQUARE, SQUARE, SQUARE, SQUARE],
  mixed: [LANDSCAPE, PORTRAIT, SQUARE, LANDSCAPE, PORTRAIT, SQUARE],
  extreme: [MAX_CELL_ASPECT_RATIO, MIN_CELL_ASPECT_RATIO, SQUARE, LANDSCAPE, PORTRAIT, SQUARE],
};

const WIDTH_BUDGETS = [320, 400, 560, 700, 900];

const overlaps = (a: ImageCellRect, b: ImageCellRect): boolean =>
  a.left < b.left + b.width - 0.01 &&
  b.left < a.left + a.width - 0.01 &&
  a.top < b.top + b.height - 0.01 &&
  b.top < a.top + a.height - 0.01;

const eachLayout = (
  buildTile: (aspectRatios: number[]) => ImageTile,
  assertLayout: (
    layout: ImageGridLayout,
    aspectRatios: number[],
    widthBudget: number,
    maxHeight: number,
    label: string
  ) => void
) => {
  COUNTS.forEach((count) => {
    const maxHeight = maxHeightForCount(count);
    Object.entries(ASPECT_RATIO_MIXES).forEach(([mixName, mix]) => {
      const aspectRatios = mix.slice(0, count);
      WIDTH_BUDGETS.forEach((widthBudget) => {
        assertLayout(
          buildImageGridLayout(buildTile(aspectRatios), widthBudget, maxHeight),
          aspectRatios,
          widthBudget,
          maxHeight,
          `${count} ${mixName} images at ${widthBudget}px`
        );
      });
    });
  });
};

describe('cellAspectRatio', () => {
  it('clamps ratios that would crush their row mates', () => {
    expect(cellAspectRatio(4000, 300)).toBe(MAX_CELL_ASPECT_RATIO);
    expect(cellAspectRatio(300, 4000)).toBe(MIN_CELL_ASPECT_RATIO);
  });

  it('falls back to square when the event carries no dimensions', () => {
    expect(cellAspectRatio(undefined, undefined)).toBe(1);
  });
});

describe.each([
  ['mosaic', buildMosaicTile],
  ['narrow', buildNarrowTile],
])('%s layout', (_name, buildTile) => {
  it('gives every cell its own aspect ratio, so nothing is cropped', () => {
    eachLayout(buildTile, (layout, aspectRatios, _widthBudget, _maxHeight, label) => {
      layout.cells.forEach((cell) => {
        expect(cell.width / cell.height, `${label}, cell ${cell.index}`).toBeCloseTo(
          aspectRatios[cell.index],
          4
        );
      });
    });
  });

  it('fills its own box exactly, leaving no ragged edge', () => {
    eachLayout(buildTile, (layout, _aspectRatios, _widthBudget, _maxHeight, label) => {
      const rightMost = Math.max(...layout.cells.map((cell) => cell.left + cell.width));
      const bottomMost = Math.max(...layout.cells.map((cell) => cell.top + cell.height));
      expect(rightMost, label).toBeCloseTo(layout.width, 4);
      expect(bottomMost, label).toBeCloseTo(layout.height, 4);
      expect(Math.min(...layout.cells.map((cell) => cell.left)), label).toBeCloseTo(0, 4);
      expect(Math.min(...layout.cells.map((cell) => cell.top)), label).toBeCloseTo(0, 4);
    });
  });

  it('never grows past the width budget or the height cap', () => {
    eachLayout(buildTile, (layout, _aspectRatios, widthBudget, maxHeight, label) => {
      expect(layout.width, label).toBeLessThanOrEqual(widthBudget + 0.01);
      expect(layout.height, label).toBeLessThanOrEqual(maxHeight + 0.01);
    });
  });

  it('keeps cells apart', () => {
    eachLayout(buildTile, (layout, _aspectRatios, _widthBudget, _maxHeight, label) => {
      layout.cells.forEach((cell, cellIndex) => {
        layout.cells.slice(cellIndex + 1).forEach((other) => {
          expect(overlaps(cell, other), `${label}, cells ${cell.index} and ${other.index}`).toBe(
            false
          );
        });
      });
    });
  });

  it('emits one cell per image', () => {
    eachLayout(buildTile, (layout, aspectRatios, _widthBudget, _maxHeight, label) => {
      expect(
        layout.cells.map((cell) => cell.index).sort((a, b) => a - b),
        label
      ).toEqual(aspectRatios.map((_ratio, index) => index));
    });
  });
});

describe('mosaic layout', () => {
  it('gives 3 and 5 image groups a hero cell spanning the full height', () => {
    ([3, 5] as Count[]).forEach((count) => {
      const aspectRatios = ASPECT_RATIO_MIXES.square.slice(0, count);
      const layout = buildImageGridLayout(buildMosaicTile(aspectRatios), 700, GRID_MAX_HEIGHT);
      const hero = layout.cells.find((cell) => cell.index === 0);
      expect(hero?.height).toBeCloseTo(layout.height, 4);
      expect(hero?.left).toBeCloseTo(0, 4);
    });
  });

  it('grows to the height cap rather than stopping short of it', () => {
    const layout = buildImageGridLayout(
      buildMosaicTile(ASPECT_RATIO_MIXES.square.slice(0, 4)),
      GRID_MAX_HEIGHT * 2,
      GRID_MAX_HEIGHT
    );
    expect(layout.height).toBeCloseTo(GRID_MAX_HEIGHT, 4);
  });
});

describe('narrow layout', () => {
  it('lays images out in the row sizes the count calls for', () => {
    COUNTS.forEach((count) => {
      const layout = buildImageGridLayout(
        buildNarrowTile(ASPECT_RATIO_MIXES.square.slice(0, count)),
        360,
        maxHeightForCount(count)
      );
      const rowTops = [...new Set(layout.cells.map((cell) => Math.round(cell.top)))].sort(
        (a, b) => a - b
      );
      const rowSizes = rowTops.map(
        (top) => layout.cells.filter((cell) => Math.round(cell.top) === top).length
      );
      expect(rowSizes, `${count} images`).toEqual(narrowRowSizesForCount[count]);
    });
  });
});
