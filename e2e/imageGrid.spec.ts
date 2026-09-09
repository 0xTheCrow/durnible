import { test, expect } from '@playwright/test';
import type { BrowserContext, Page } from '@playwright/test';
import {
  seedSession,
  seedSettings,
  stubHomeserver,
  imageEvent,
  TEST_ROOM_ID,
} from './fixtures/homeserver';
import type { Settings } from '../src/app/state/settings';
import type { Count } from '../src/app/components/message/imageGridLayout';
import {
  GRID_MAX_CELLS,
  GRID_MAX_HEIGHT,
  WIDE_LAYOUT_MIN_WIDTH,
  MOBILE_STACK_MAX_WIDTH,
  narrowRowSizesForCount,
} from '../src/app/components/message/imageGridLayout';
import { MOBILE_BREAKPOINT } from '../src/app/styles/breakpoints';
import { PAGE_NAV_MAX_CONTAINER_FRACTION } from '../src/app/components/page/pageNavLayout';

const roomPath = `/home/${encodeURIComponent(TEST_ROOM_ID)}/`;

const CELL_TEST_ID = 'image-grid-cell';

const NATURAL_WIDTH = 2000;
const NATURAL_HEIGHT = 800;
const NATURAL_GRID_WIDTH = Math.round(NATURAL_WIDTH * (GRID_MAX_HEIGHT / NATURAL_HEIGHT));

const VIEWPORT_HEIGHT = 800;
const WIDE_LAYOUT_VIEWPORT = { width: 1400, height: VIEWPORT_HEIGHT };
const NARROWEST_NON_MOBILE_VIEWPORT = { width: MOBILE_BREAKPOINT + 1, height: VIEWPORT_HEIGHT };
const MOBILE_VIEWPORT = { width: MOBILE_BREAKPOINT, height: VIEWPORT_HEIGHT };

const WIDEST_PAGE_NAV_WIDTH = Math.floor(
  NARROWEST_NON_MOBILE_VIEWPORT.width * PAGE_NAV_MAX_CONTAINER_FRACTION
);

const openRoomWithGallery = async (
  context: BrowserContext,
  page: Page,
  imageCount: Count,
  viewport: { width: number; height: number },
  settings?: Partial<Settings>,
  dimensionsFor: (index: number) => { width: number; height: number } = () => ({
    width: NATURAL_WIDTH,
    height: NATURAL_HEIGHT,
  })
) => {
  await seedSession(context);
  if (settings) await seedSettings(page, settings);
  await stubHomeserver(page, {
    timelineEvents: Array.from({ length: imageCount }, (_, index) => {
      const { width, height } = dimensionsFor(index);
      return imageEvent(index, width, height);
    }),
  });
  await page.setViewportSize(viewport);
  await page.goto(roomPath);
  await expect(page.getByTestId('image-grid')).toBeVisible();
  await expect(page.getByTestId(CELL_TEST_ID)).toHaveCount(imageCount);
};

type CellBox = { x: number; y: number; width: number; height: number };

const boxOf = async (page: Page, testId: string) => {
  const box = await page.getByTestId(testId).boundingBox();
  if (!box) throw new Error(`${testId} has no bounding box`);
  return box;
};

const readCellBoxes = (page: Page): Promise<CellBox[]> =>
  page.evaluate(
    (testId) =>
      Array.from(document.querySelectorAll(`[data-testid="${testId}"]`)).map((cell) => {
        const { x, y, width, height } = cell.getBoundingClientRect();
        return { x, y, width, height };
      }),
    CELL_TEST_ID
  );

const cellBoxes = async (page: Page): Promise<CellBox[]> => {
  await expect
    .poll(async () => {
      const boxes = await readCellBoxes(page);
      return boxes.length > 0 && boxes.every((box) => box.width > 0 && box.height > 0);
    })
    .toBe(true);
  return readCellBoxes(page);
};

const cellsInFirstRow = async (page: Page): Promise<number> => {
  const boxes = await cellBoxes(page);
  const firstRowY = Math.min(...boxes.map((box) => box.y));
  return boxes.filter((box) => Math.abs(box.y - firstRowY) < 1).length;
};

const expectCellsWithinContainer = async (page: Page) => {
  const container = await boxOf(page, 'image-grid-container');
  const boxes = await cellBoxes(page);
  const leftMost = Math.min(...boxes.map((box) => box.x));
  const rightMost = Math.max(...boxes.map((box) => box.x + box.width));
  expect(leftMost).toBeGreaterThanOrEqual(container.x - 1);
  expect(rightMost).toBeLessThanOrEqual(container.x + container.width + 1);
};

test('every cell keeps its image aspect ratio instead of cropping to a square', async ({
  context,
  page,
}) => {
  const dimensions = [
    { width: 1600, height: 900 },
    { width: 900, height: 1600 },
    { width: 1000, height: 1000 },
    { width: 1600, height: 900 },
    { width: 900, height: 1600 },
    { width: 1200, height: 800 },
  ];

  await openRoomWithGallery(
    context,
    page,
    GRID_MAX_CELLS,
    WIDE_LAYOUT_VIEWPORT,
    undefined,
    (index) => dimensions[index]
  );

  const boxes = await cellBoxes(page);
  boxes.forEach((box, index) => {
    const { width, height } = dimensions[index];
    expect(box.width / box.height, `cell ${index} is cropped`).toBeCloseTo(width / height, 1);
  });
});

test('grid clamps to the content column instead of overflowing it', async ({ context, page }) => {
  await openRoomWithGallery(context, page, 2, WIDE_LAYOUT_VIEWPORT);

  const container = await boxOf(page, 'image-grid-container');
  expect(
    container.width,
    'container must be at least WIDE_LAYOUT_MIN_WIDTH, or the grid takes the narrow fallback'
  ).toBeGreaterThanOrEqual(WIDE_LAYOUT_MIN_WIDTH);
  expect(
    NATURAL_GRID_WIDTH,
    'images must want more width than the column has, or nothing is being clamped'
  ).toBeGreaterThan(container.width);

  await expectCellsWithinContainer(page);
});

test('narrow content column falls back to the stacked layout instead of clipping', async ({
  context,
  page,
}) => {
  await openRoomWithGallery(context, page, GRID_MAX_CELLS, NARROWEST_NON_MOBILE_VIEWPORT, {
    pageNavWidth: WIDEST_PAGE_NAV_WIDTH,
  });

  const bodyWidth = await page.evaluate(() => document.body.clientWidth);
  expect(
    bodyWidth,
    'viewport must stay above the mobile breakpoint, or this exercises the mobile path'
  ).toBeGreaterThan(MOBILE_BREAKPOINT);

  const container = await boxOf(page, 'image-grid-container');
  expect(
    container.width,
    'container must be under WIDE_LAYOUT_MIN_WIDTH, or the narrow fallback never triggers'
  ).toBeLessThan(WIDE_LAYOUT_MIN_WIDTH);

  expect(await cellsInFirstRow(page)).toBe(narrowRowSizesForCount[GRID_MAX_CELLS][0]);
  await expectCellsWithinContainer(page);

  const grid = await boxOf(page, 'image-grid');
  expect(grid.width).toBeCloseTo(container.width, 0);
});

test('a two image gallery stacks one per row on mobile', async ({ context, page }) => {
  await openRoomWithGallery(context, page, 2, MOBILE_VIEWPORT);

  const bodyWidth = await page.evaluate(() => document.body.clientWidth);
  expect(
    bodyWidth,
    'viewport must be a mobile screen, or this exercises the desktop path'
  ).toBeLessThanOrEqual(MOBILE_BREAKPOINT);

  expect(await cellsInFirstRow(page)).toBe(narrowRowSizesForCount[2][0]);

  const container = await boxOf(page, 'image-grid-container');
  expect(
    container.width,
    'column must be wider than the mobile cap, or the cap is not what bounds the cell'
  ).toBeGreaterThan(MOBILE_STACK_MAX_WIDTH);

  const boxes = await cellBoxes(page);
  expect(boxes[1].y).toBeGreaterThan(boxes[0].y + boxes[0].height - 1);
  boxes.forEach((box) => expect(box.width).toBeLessThanOrEqual(MOBILE_STACK_MAX_WIDTH + 1));
  await expectCellsWithinContainer(page);
});

const ENLARGED_ROOT_FONT_SIZE = 20;

test('grid tracks stay inside the column when the root font size is enlarged', async ({
  context,
  page,
}) => {
  await openRoomWithGallery(context, page, GRID_MAX_CELLS, {
    width: 1400,
    height: VIEWPORT_HEIGHT,
  });

  await page.evaluate((fontSizePx) => {
    document.documentElement.style.fontSize = `${fontSizePx}px`;
  }, ENLARGED_ROOT_FONT_SIZE);

  await expect
    .poll(async () => (await boxOf(page, 'image-grid-container')).width)
    .toBeGreaterThanOrEqual(WIDE_LAYOUT_MIN_WIDTH);

  const container = await boxOf(page, 'image-grid-container');
  const grid = await boxOf(page, 'image-grid');
  expect(
    grid.width * (ENLARGED_ROOT_FONT_SIZE / 16),
    'column must be narrower than the grid would be if its tracks scaled with the root font size, or nothing is being tested'
  ).toBeGreaterThan(container.width);

  await expectCellsWithinContainer(page);
});

test('layout tracks the container across resizes', async ({ context, page }) => {
  await openRoomWithGallery(context, page, GRID_MAX_CELLS, WIDE_LAYOUT_VIEWPORT, undefined, () => ({
    width: 1000,
    height: 1000,
  }));
  const mosaicFirstRowCells = await cellsInFirstRow(page);
  const narrowFirstRowCells = narrowRowSizesForCount[GRID_MAX_CELLS][0];
  expect(
    mosaicFirstRowCells,
    'mosaic and narrow layouts must differ, or a resize that never re-lays out still passes'
  ).not.toBe(narrowFirstRowCells);

  await page.setViewportSize(MOBILE_VIEWPORT);
  await expect.poll(() => cellsInFirstRow(page)).toBe(narrowFirstRowCells);
  await expectCellsWithinContainer(page);

  await page.setViewportSize(WIDE_LAYOUT_VIEWPORT);
  await expect.poll(() => cellsInFirstRow(page)).toBe(mosaicFirstRowCells);
  await expectCellsWithinContainer(page);
});
