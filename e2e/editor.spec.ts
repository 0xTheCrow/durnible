import { test, expect, type Page } from '@playwright/test';
import {
  RICH_TEXT_EDITOR_SETTINGS,
  seedSession,
  seedSettings,
  stubHomeserver,
  TEST_CUSTOM_EMOJI_MXC,
  TEST_CUSTOM_EMOJI_SHORTCODE,
  TEST_ROOM_ID,
  type HomeserverStub,
  type StubHomeserverOptions,
} from './fixtures/homeserver';

const roomPath = `/home/${encodeURIComponent(TEST_ROOM_ID)}/`;

let homeserver: HomeserverStub;

test.beforeEach(async ({ context }) => {
  await seedSession(context);
});

const openRoom = async (page: Page, options: StubHomeserverOptions = {}) => {
  homeserver = await stubHomeserver(page, options);
  await page.goto(roomPath);
};

test('boots into a room with the composer focused', async ({ page }) => {
  await openRoom(page);

  await expect(page.getByTestId('editor')).toBeVisible();
  expect(
    homeserver.unmatched,
    `unmatched homeserver routes: ${homeserver.unmatched.join(', ')}`
  ).toEqual([]);
});

test('plain text sends without a formatted body', async ({ page }) => {
  await openRoom(page);

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
  await seedSettings(page, RICH_TEXT_EDITOR_SETTINGS);
  await openRoom(page);

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

test('a trailing line break does not reach the sent event', async ({ page }) => {
  await seedSettings(page, RICH_TEXT_EDITOR_SETTINGS);
  await openRoom(page);

  const editor = page.getByTestId('editor');
  await expect(editor).toBeVisible();
  await editor.click();
  await editor.pressSequentially('hello');
  await page.keyboard.press('Shift+Enter');
  await page.keyboard.press('Enter');

  await expect.poll(() => homeserver.sentEvents.length).toBe(1);

  const [sent] = homeserver.sentEvents;
  expect(sent.content.body).toBe('hello');
  expect(sent.content.formatted_body).toBeUndefined();
});

test('an empty line between two lines is sent as one empty line', async ({ page }) => {
  await seedSettings(page, { ...RICH_TEXT_EDITOR_SETTINGS, enterForNewline: true });
  await openRoom(page);

  const editor = page.getByTestId('editor');
  await expect(editor).toBeVisible();
  await editor.click();
  await editor.pressSequentially('hello');
  await page.keyboard.press('Enter');
  await page.keyboard.press('Enter');
  await editor.pressSequentially('world');
  await page.keyboard.press('ControlOrMeta+Enter');

  await expect.poll(() => homeserver.sentEvents.length).toBe(1);

  const [sent] = homeserver.sentEvents;
  expect(sent.content.body).toBe('hello\n\nworld');
});

test('the send button survives a newline after a custom emoji', async ({ page }) => {
  await seedSettings(page, { ...RICH_TEXT_EDITOR_SETTINGS, enterForNewline: true });
  await openRoom(page, { userImagePack: true });

  const editor = page.getByTestId('editor');
  await expect(editor).toBeVisible();
  await editor.click();

  await editor.pressSequentially(`:${TEST_CUSTOM_EMOJI_SHORTCODE}`);
  await page.keyboard.press('Tab');
  await expect(
    editor.locator(`[data-node-type="emoticon"][data-key="${TEST_CUSTOM_EMOJI_MXC}"]`)
  ).toBeVisible();
  await expect(page.getByTestId('room-input-send')).toBeVisible();

  await page.keyboard.press('Enter');

  await expect(page.getByTestId('room-input-send')).toBeVisible();
  await expect(page.getByTestId('room-input-voice-record')).toBeHidden();
});

test('bold text survives serialization into the sent event', async ({ page }) => {
  await seedSettings(page, RICH_TEXT_EDITOR_SETTINGS);
  await openRoom(page);

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
