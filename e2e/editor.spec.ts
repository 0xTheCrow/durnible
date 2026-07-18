import { test, expect } from '@playwright/test';
import {
  seedSession,
  stubHomeserver,
  TEST_ROOM_ID,
  type HomeserverStub,
} from './fixtures/homeserver';

const roomPath = `/home/${encodeURIComponent(TEST_ROOM_ID)}/`;

let homeserver: HomeserverStub;

test.beforeEach(async ({ context, page }) => {
  await seedSession(context);
  homeserver = await stubHomeserver(page);
});

test('boots into a room with the composer focused', async ({ page }) => {
  await page.goto(roomPath);

  await expect(page.getByTestId('editor')).toBeVisible();
  expect(
    homeserver.unmatched,
    `unmatched homeserver routes: ${homeserver.unmatched.join(', ')}`
  ).toEqual([]);
});

test('plain text sends without a formatted body', async ({ page }) => {
  await page.goto(roomPath);

  const editor = page.getByTestId('editor');
  await expect(editor).toBeVisible();
  await editor.click();
  await editor.pressSequentially('hello');
  await page.keyboard.press('Enter');

  await expect.poll(() => homeserver.sentEvents.length).toBe(1);

  const [sent] = homeserver.sentEvents;
  expect(sent.content.body).toBe('hello');
  expect(sent.content.formatted_body).toBeUndefined();
});

test('erasing bold text clears the pending style so new text is not bold', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('settings', JSON.stringify({ editorToolbar: true }));
  });
  await page.goto(roomPath);

  const editor = page.getByTestId('editor');
  await expect(editor).toBeVisible();
  await editor.click();

  const boldButton = page.getByTestId('editor-toolbar-bold');
  await expect(boldButton).toBeVisible();

  // Enable bold, then type: the text is bold and the button reads active.
  await page.keyboard.press('ControlOrMeta+b');
  await editor.pressSequentially('hello');
  await expect(boldButton).toHaveAttribute('aria-pressed', 'true');

  // Backspace the whole message away.
  for (let i = 0; i < 'hello'.length; i += 1) {
    // eslint-disable-next-line no-await-in-loop
    await page.keyboard.press('Backspace');
  }

  // Empty message: bold must read as inactive.
  await expect(editor).toHaveText('');
  await expect(boldButton).toHaveAttribute('aria-pressed', 'false');

  // Typing again must produce unformatted text, with the button still inactive.
  await editor.pressSequentially('x');
  await expect(boldButton).toHaveAttribute('aria-pressed', 'false');

  await page.keyboard.press('Enter');
  await expect.poll(() => homeserver.sentEvents.length).toBe(1);

  const [sent] = homeserver.sentEvents;
  expect(sent.content.body).toBe('x');
  expect(sent.content.formatted_body).toBeUndefined();
});

test('bold text survives serialization into the sent event', async ({ page }) => {
  await page.goto(roomPath);

  const editor = page.getByTestId('editor');
  await expect(editor).toBeVisible();
  await editor.click();
  await editor.pressSequentially('hello');

  await page.keyboard.press('ControlOrMeta+a');
  await page.keyboard.press('ControlOrMeta+b');
  await page.keyboard.press('Enter');

  await expect.poll(() => homeserver.sentEvents.length).toBe(1);

  const [sent] = homeserver.sentEvents;
  expect(sent.eventType).toBe('m.room.message');
  expect(sent.content.body).toBe('hello');
  expect(sent.content.formatted_body).toBe('<strong>hello</strong>');
});
