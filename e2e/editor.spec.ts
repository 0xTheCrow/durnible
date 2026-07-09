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
