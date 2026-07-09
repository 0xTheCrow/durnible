import { test, expect } from '@playwright/test';
import { seedSession, stubHomeserver, TEST_ROOM_ID } from './fixtures/homeserver';

const roomPath = `/home/${encodeURIComponent(TEST_ROOM_ID)}/`;

test.beforeEach(async ({ context, page }) => {
  await seedSession(context);
  await stubHomeserver(page);
});

test('untoggling an ordered list leaves the item text unchanged', async ({ page }) => {
  await page.goto(roomPath);

  const editor = page.getByTestId('editor');
  await expect(editor).toBeVisible();
  await editor.click();
  await editor.pressSequentially('item');

  await page.getByTestId('room-input-toolbar-toggle').click();
  const orderedList = page.getByTestId('editor-toolbar-ordered-list');
  await expect(orderedList).toBeVisible();

  await orderedList.click();
  await expect(editor.locator('ol li')).toHaveText('item');

  await orderedList.click();

  await expect(editor.locator('ol')).toHaveCount(0);
  await expect(editor).toHaveText('item');
});
