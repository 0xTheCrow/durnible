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
  GRID_MIN_WIDTH,
  MOBILE_STACK_MAX_WIDTH,
  SINGLE_IMAGE_MAX_HEIGHT,
  gridColumnsForCount,
  stackColumnsForCount,
} from '../src/app/components/message/imageGridLayout';
import { MOBILE_BREAKPOINT, TABLET_BREAKPOINT } from '../src/app/styles/breakpoints';
import { PAGE_NAV_MAX_CONTAINER_FRACTION } from '../src/app/components/page/pageNavLayout';

const roomPath = `/home/${encodeURIComponent(TEST_ROOM_ID)}/`;

const CELL_TEST_ID = 'image-grid-cell';

const NATURAL_WIDTH = 2000;
const NATURAL_HEIGHT = 800;
const NATURAL_GRID_WIDTH = Math.round(NATURAL_WIDTH * (SINGLE_IMAGE_MAX_HEIGHT / NATURAL_HEIGHT));

const VIEWPORT_HEIGHT = 800;
const NARROWEST_DESKTOP_VIEWPORT = { width: TABLET_BREAKPOINT + 1, height: VIEWPORT_HEIGHT };
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
  settings?: Partial<Settings>
) => {
  await seedSession(context);
  if (settings) await seedSettings(page, settings);
  await stubHomeserver(page, {
    timelineEvents: Array.from({ length: imageCount }, (_, index) =>
      imageEvent(index, NATURAL_WIDTH, NATURAL_HEIGHT)
    ),
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

test('grid clamps to the content column instead of overflowing it', async ({ context, page }) => {
  await openRoomWithGallery(context, page, 2, NARROWEST_DESKTOP_VIEWPORT);

  const container = await boxOf(page, 'image-grid-container');
  expect(
    container.width,
    'container must be at least GRID_MIN_WIDTH, or the grid takes the stack fallback'
  ).toBeGreaterThanOrEqual(GRID_MIN_WIDTH);
  expect(
    NATURAL_GRID_WIDTH,
    'images must want more width than the column has, or nothing is being clamped'
  ).toBeGreaterThan(container.width);

  await expectCellsWithinContainer(page);
});

test('narrow content column falls back to the stack layout instead of clipping', async ({
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
    'container must be under GRID_MIN_WIDTH, or the stack fallback never triggers'
  ).toBeLessThan(GRID_MIN_WIDTH);

  expect(await cellsInFirstRow(page)).toBe(stackColumnsForCount[GRID_MAX_CELLS]);
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

  expect(await cellsInFirstRow(page)).toBe(stackColumnsForCount[2]);

  const container = await boxOf(page, 'image-grid-container');
  expect(
    container.width,
    'column must be wider than the mobile cap, or the cap is not what bounds the cell'
  ).toBeGreaterThan(MOBILE_STACK_MAX_WIDTH);

  const boxes = await cellBoxes(page);
  expect(boxes[1].y).toBeGreaterThan(boxes[0].y + boxes[0].height - 1);
  boxes.forEach((box) => expect(box.height).toBeLessThanOrEqual(MOBILE_STACK_MAX_WIDTH));
  await expectCellsWithinContainer(page);
});

test('layout tracks the container across resizes', async ({ context, page }) => {
  await openRoomWithGallery(context, page, GRID_MAX_CELLS, NARROWEST_DESKTOP_VIEWPORT);
  expect(await cellsInFirstRow(page)).toBe(gridColumnsForCount[GRID_MAX_CELLS]);

  await page.setViewportSize(MOBILE_VIEWPORT);
  await expect.poll(() => cellsInFirstRow(page)).toBe(stackColumnsForCount[GRID_MAX_CELLS]);
  await expectCellsWithinContainer(page);

  await page.setViewportSize(NARROWEST_DESKTOP_VIEWPORT);
  await expect.poll(() => cellsInFirstRow(page)).toBe(gridColumnsForCount[GRID_MAX_CELLS]);
  await expectCellsWithinContainer(page);
});
