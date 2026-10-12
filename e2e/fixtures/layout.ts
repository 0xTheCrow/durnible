import { expect } from '@playwright/test';
import type { Locator, Page } from '@playwright/test';

export const LAYOUT_TOLERANCE_PX = 1;

export const readBoundingBox = async (locator: Locator) => {
  const box = await locator.boundingBox();
  if (!box) throw new Error(`${locator} has no bounding box`);
  return box;
};

export const expectCloseTo = (actual: number, expected: number) =>
  expect(Math.abs(actual - expected)).toBeLessThanOrEqual(LAYOUT_TOLERANCE_PX);

export const dragFromCenter = async (
  page: Page,
  locator: Locator,
  targetX: number,
  targetY: number
) => {
  const box = await readBoundingBox(locator);
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(targetX, targetY, { steps: 10 });
  await page.mouse.up();
};
