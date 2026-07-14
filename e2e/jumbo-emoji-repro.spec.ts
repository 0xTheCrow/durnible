import { test, expect, type Page } from '@playwright/test';
import { seedSession, stubHomeserver, TEST_ROOM_ID, TEST_USER_ID } from './fixtures/homeserver';

const roomPath = `/home/${encodeURIComponent(TEST_ROOM_ID)}/`;

const CUSTOM_EMOJI_IMG =
  '<img data-mx-emoticon src="mxc://matrix.test/emoji1" alt=":party:" title=":party:" height="32">';

const textEvent = (id: string, body: string, formattedBody?: string): Record<string, unknown> => ({
  type: 'm.room.message',
  sender: TEST_USER_ID,
  content: {
    msgtype: 'm.text',
    body,
    ...(formattedBody ? { format: 'org.matrix.custom.html', formatted_body: formattedBody } : {}),
  },
  event_id: id,
  origin_server_ts: 1700000001000,
});

const messageBodyFontSizes = (page: Page): Promise<number[]> =>
  page
    .locator('[data-testid="message-body"]')
    .evaluateAll((bodies) => bodies.map((body) => parseFloat(getComputedStyle(body).fontSize)));

test('emoji-only messages scale up for stock, custom, and mixed emojis', async ({
  context,
  page,
}) => {
  await seedSession(context);
  await stubHomeserver(page, {
    timelineEvents: [
      textEvent('$stockonly', '😀'),
      textEvent('$customonly', ':party:', CUSTOM_EMOJI_IMG),
      textEvent('$mixed', '😀 :party:', `😀 ${CUSTOM_EMOJI_IMG}`),
      textEvent('$plaintext', 'plain control message'),
    ],
  });

  await page.goto(roomPath);
  await expect(page.getByTestId('editor')).toBeVisible();
  await expect(page.getByTestId('message-body')).toHaveCount(5);

  const [, stockOnly, customOnly, mixed, plainControl] = await messageBodyFontSizes(page);

  expect(stockOnly).toBeGreaterThan(plainControl);
  expect(customOnly).toBeGreaterThan(plainControl);
  expect(mixed).toBeGreaterThan(plainControl);
});
