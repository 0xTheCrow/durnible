import { test, expect, type Page } from '@playwright/test';
import {
  seedSession,
  stubHomeserver,
  TEST_ROOM_ID,
  type HomeserverStub,
} from './fixtures/homeserver';

const roomPath = `/home/${encodeURIComponent(TEST_ROOM_ID)}/`;

let homeserver: HomeserverStub;

test.beforeEach(async ({ context, page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('settings', JSON.stringify({ editorToolbar: true }));
  });
  await seedSession(context);
  homeserver = await stubHomeserver(page);
});

const focusComposer = async (page: Page) => {
  await page.goto(roomPath);
  const editor = page.getByTestId('editor');
  await expect(editor).toBeVisible();
  await editor.click();
  return editor;
};

const sentFormattedBody = async (page: Page): Promise<string | undefined> => {
  await page.keyboard.press('Enter');
  await expect.poll(() => homeserver.sentEvents.length).toBe(1);
  return homeserver.sentEvents[0].content.formatted_body as string | undefined;
};

test('toggling spoiler then typing keeps the whole run inside the spoiler', async ({ page }) => {
  await focusComposer(page);
  await page.getByTestId('editor-toolbar-spoiler').click();
  await page.keyboard.type('secret');

  expect(await sentFormattedBody(page)).toBe('<span data-mx-spoiler>secret</span>');
});

test('toggling inline code then typing keeps the whole run inside the code span', async ({
  page,
}) => {
  await focusComposer(page);
  await page.getByTestId('editor-toolbar-inline-code').click();
  await page.keyboard.type('secret');

  expect(await sentFormattedBody(page)).toBe('<code>secret</code>');
});

// Option B: a boundary anchor gives a reachable caret position outside the span,
// so text placed after it (End) lands outside, on the trailing side.
test('caret can move past the end of a spoiler to type unformatted text after it', async ({
  page,
}) => {
  await focusComposer(page);
  await page.getByTestId('editor-toolbar-spoiler').click();
  await page.keyboard.type('secret');
  await page.keyboard.press('End');
  await page.keyboard.type(' tail');

  expect(await sentFormattedBody(page)).toBe('<span data-mx-spoiler>secret</span> tail');
});

// ...and on the leading side: placing the caret before the span (Home) types outside it.
test('caret can move before the start of a spoiler to type unformatted text before it', async ({
  page,
}) => {
  await focusComposer(page);
  await page.getByTestId('editor-toolbar-spoiler').click();
  await page.keyboard.type('secret');
  await page.keyboard.press('Home');
  await page.keyboard.type('lead ');

  expect(await sentFormattedBody(page)).toBe('lead <span data-mx-spoiler>secret</span>');
});
