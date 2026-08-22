import { test, expect, devices, type Page } from '@playwright/test';
import {
  seedSession,
  stubHomeserver,
  TEST_ROOM_ID,
  type StubHomeserverOptions,
} from './fixtures/homeserver';

const roomPath = `/home/${encodeURIComponent(TEST_ROOM_ID)}/`;

test.use({ ...devices['Pixel 5'] });

test.beforeEach(async ({ context }) => {
  await seedSession(context);
});

const openRoom = async (page: Page, options: StubHomeserverOptions = {}) => {
  await stubHomeserver(page, options);
  await page.goto(roomPath);
};

type ComposerBlurWindow = Window & { composerBlurCount: number };

const countComposerBlurs = (page: Page) =>
  page.evaluate(() => {
    (window as unknown as ComposerBlurWindow).composerBlurCount = 0;
    document.addEventListener(
      'focusout',
      (evt) => {
        if ((evt.target as Element).getAttribute?.('data-testid') === 'editor') {
          (window as unknown as ComposerBlurWindow).composerBlurCount += 1;
        }
      },
      true
    );
  });

test('tapping a mention keeps the composer focused so typing continues', async ({ page }) => {
  await openRoom(page);

  const editor = page.getByTestId('editor');
  await expect(editor).toBeVisible();
  await editor.tap();
  await editor.pressSequentially('@');

  const mentionItem = page.locator('[class*="AutocompleteMenuContainer"] button').first();
  await expect(mentionItem).toBeVisible();

  await countComposerBlurs(page);

  const box = await mentionItem.boundingBox();
  if (!box) throw new Error('mention item is not laid out');
  await page.touchscreen.tap(box.x + box.width / 2, box.y + box.height / 2);

  await expect(editor.locator('[data-node-type="mention"]')).toHaveAttribute(
    'data-id',
    '@tester:matrix.test'
  );
  expect(
    await page.evaluate(() => (window as unknown as ComposerBlurWindow).composerBlurCount)
  ).toBe(0);

  await page.keyboard.type('hello');
  await expect(editor).toHaveText(/@Tester\s+hello/);
});
