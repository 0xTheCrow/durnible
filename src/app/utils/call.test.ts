import { describe, it, expect } from 'vitest';
import {
  CALL_TILE_ASPECT_RATIO,
  CALL_TILE_GAP,
  CALL_TILE_MIN_WIDTH,
  CALL_TILE_PORTRAIT_ASPECT_RATIO,
  getCallTileGridLayout,
} from './call';

describe('getCallTileGridLayout', () => {
  it.each([
    { name: 'no tiles', tileCount: 0, width: 800, height: 600 },
    { name: 'zero width', tileCount: 4, width: 0, height: 600 },
    { name: 'zero height', tileCount: 4, width: 800, height: 0 },
    { name: 'negative width', tileCount: 4, width: -800, height: 600 },
  ])('returns an empty layout for $name', ({ tileCount, width, height }) => {
    expect(getCallTileGridLayout(tileCount, width, height)).toEqual({
      columnCount: 1,
      tileWidth: 0,
      tileHeight: 0,
      visibleTileCount: 0,
    });
  });

  it('shows every tile when they all fit above the minimum width', () => {
    const layout = getCallTileGridLayout(4, 800, 600);

    expect(layout.visibleTileCount).toBe(4);
    expect(layout.tileWidth).toBeGreaterThanOrEqual(CALL_TILE_MIN_WIDTH);
  });

  it('truncates until the visible tiles clear the minimum width', () => {
    const tileCount = 12;
    const layout = getCallTileGridLayout(tileCount, 300, 240);

    expect(layout.visibleTileCount).toBeGreaterThan(0);
    expect(layout.visibleTileCount).toBeLessThan(tileCount);
    expect(layout.tileWidth).toBeGreaterThanOrEqual(CALL_TILE_MIN_WIDTH);
  });

  it('keeps a lone tile visible even below the minimum width', () => {
    const layout = getCallTileGridLayout(1, 60, 40);

    expect(layout.visibleTileCount).toBe(1);
    expect(layout.tileWidth).toBeGreaterThan(0);
    expect(layout.tileWidth).toBeLessThan(CALL_TILE_MIN_WIDTH);
  });

  it('falls back to one undersized tile when nothing can clear the minimum width', () => {
    const layout = getCallTileGridLayout(8, 100, 80);

    expect(layout.visibleTileCount).toBe(1);
    expect(layout.tileWidth).toBeGreaterThan(0);
    expect(layout.tileWidth).toBeLessThan(CALL_TILE_MIN_WIDTH);
  });

  it('picks the column count that makes tiles widest, leaving room for gaps', () => {
    const wideShort = getCallTileGridLayout(4, 800, 200);
    const square = getCallTileGridLayout(4, 400, 400);

    expect(wideShort.columnCount).toBeGreaterThan(square.columnCount);

    [
      { layout: wideShort, containerWidth: 800 },
      { layout: square, containerWidth: 400 },
    ].forEach(({ layout, containerWidth }) => {
      const usedWidth =
        layout.columnCount * layout.tileWidth + (layout.columnCount - 1) * CALL_TILE_GAP;
      expect(usedWidth).toBeLessThanOrEqual(containerWidth);
    });
  });

  it('defaults to the landscape aspect ratio', () => {
    expect(getCallTileGridLayout(4, 800, 600)).toEqual(
      getCallTileGridLayout(4, 800, 600, CALL_TILE_ASPECT_RATIO)
    );
  });

  it('packs more columns into a tall container when tiles are portrait', () => {
    const landscape = getCallTileGridLayout(6, 300, 800);
    const portrait = getCallTileGridLayout(6, 300, 800, CALL_TILE_PORTRAIT_ASPECT_RATIO);

    expect(portrait.columnCount).toBeGreaterThan(landscape.columnCount);
    expect(portrait.tileHeight).toBe(
      Math.round(portrait.tileWidth / CALL_TILE_PORTRAIT_ASPECT_RATIO)
    );
  });
});
