import { test, expect } from '@playwright/test';
import type { BrowserContext, Page } from '@playwright/test';
import { seedSession, seedSettings, stubHomeserver, TEST_ROOM_ID } from './fixtures/homeserver';
import { dragFromCenter, expectCloseTo, readBoundingBox } from './fixtures/layout';
import {
  PAGE_NAV_MAX_CONTAINER_FRACTION,
  PAGE_NAV_MIN_WIDTH,
} from '../src/app/components/page/pageNavLayout';

const roomPath = `/home/${encodeURIComponent(TEST_ROOM_ID)}/`;
const DESKTOP_VIEWPORT = { width: 1400, height: 800 };

const openRoomWithResizableNav = async (context: BrowserContext, page: Page) => {
  await seedSession(context);
  await seedSettings(page, { isPageNavResizeEnabled: true });
  await stubHomeserver(page);
  await page.setViewportSize(DESKTOP_VIEWPORT);
  await page.goto(roomPath);
  await expect(page.getByTestId('page-nav-resize-handle')).toBeVisible();
};

const dragResizeHandleTo = async (page: Page, targetX: number) => {
  const resizeHandle = page.getByTestId('page-nav-resize-handle');
  const handleBox = await readBoundingBox(resizeHandle);
  await dragFromCenter(page, resizeHandle, targetX, handleBox.y + handleBox.height / 2);
};

test('dragging the handle sets the nav width', async ({ context, page }) => {
  await openRoomWithResizableNav(context, page);
  const nav = page.getByTestId('page-nav');
  const navBox = await readBoundingBox(nav);
  const rootBox = await readBoundingBox(page.getByTestId('page-root'));
  const maxWidth = rootBox.width * PAGE_NAV_MAX_CONTAINER_FRACTION;
  const targetWidth = Math.round((PAGE_NAV_MIN_WIDTH + maxWidth) / 2);

  await dragResizeHandleTo(page, navBox.x + targetWidth);

  expectCloseTo((await readBoundingBox(nav)).width, targetWidth);
});

test('dragging the handle past the limit caps the nav at its share of the page', async ({
  context,
  page,
}) => {
  await openRoomWithResizableNav(context, page);
  const rootBox = await readBoundingBox(page.getByTestId('page-root'));

  await dragResizeHandleTo(page, rootBox.x + rootBox.width - 1);

  expectCloseTo(
    (await readBoundingBox(page.getByTestId('page-nav'))).width,
    rootBox.width * PAGE_NAV_MAX_CONTAINER_FRACTION
  );
});
