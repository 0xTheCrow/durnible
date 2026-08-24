import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';
import {
  seedSession,
  stubHomeserver,
  textEvent,
  liveMessageEvent,
  reactionEvent,
  TEST_ROOM_ID,
} from './fixtures/homeserver';
import { PAGINATION_LIMIT } from '../src/app/features/room/timeline/timelineState';

const roomPath = `/home/${encodeURIComponent(TEST_ROOM_ID)}/`;

const FILLER_COUNT = PAGINATION_LIMIT + 40;
const SCROLL_UP_PX = 1200;
const MIN_DISPLACEMENT_PX = 400;
const LIVE_EDGE_TOLERANCE_PX = 40;
const STUCK_TO_BOTTOM_PX = 8;
const SAMPLE_DURATION_MS = 2000;

const NEWEST_EVENT_ID = `$filler${FILLER_COUNT - 1}`;
const OLDER_VISIBLE_EVENT_ID = `$filler${FILLER_COUNT - 6}`;

const timelineScrollSelector = '[data-testid="timeline-scroll"]';

const getDistanceFromBottom = (page: Page): Promise<number> =>
  page.evaluate((selector) => {
    const scrollElement = document.querySelector(selector) as HTMLElement;
    return scrollElement.scrollHeight - scrollElement.scrollTop - scrollElement.clientHeight;
  }, timelineScrollSelector);

const startSamplingDistanceFromBottom = (page: Page) =>
  page.evaluate(
    ([selector, durationMs]) => {
      const scrollElement = document.querySelector(selector as string) as HTMLElement;
      const samples: number[] = [];
      (window as unknown as { __timelineScrollSamples: number[] }).__timelineScrollSamples =
        samples;
      const startedAt = performance.now();
      const sample = () => {
        samples.push(
          scrollElement.scrollHeight - scrollElement.scrollTop - scrollElement.clientHeight
        );
        if (performance.now() - startedAt < (durationMs as number)) requestAnimationFrame(sample);
      };
      requestAnimationFrame(sample);
    },
    [timelineScrollSelector, SAMPLE_DURATION_MS] as const
  );

const collectSamples = (page: Page): Promise<number[]> =>
  page.evaluate(
    () => (window as unknown as { __timelineScrollSamples: number[] }).__timelineScrollSamples
  );

const openRoomAtLiveEdge = async (page: Page) => {
  await page.goto(roomPath);
  await expect(page.locator(`[data-message-id="${NEWEST_EVENT_ID}"]`)).toBeVisible();
  await expect.poll(() => getDistanceFromBottom(page)).toBeLessThan(STUCK_TO_BOTTOM_PX);
};

const openRoomScrolledUp = async (page: Page) => {
  await page.goto(roomPath);
  await expect(page.locator(`[data-message-id="${NEWEST_EVENT_ID}"]`)).toBeVisible();
  await expect.poll(() => getDistanceFromBottom(page)).toBeLessThan(LIVE_EDGE_TOLERANCE_PX);

  await page.locator(timelineScrollSelector).hover();
  await expect
    .poll(async () => {
      await page.mouse.wheel(0, -SCROLL_UP_PX);
      return getDistanceFromBottom(page);
    })
    .toBeGreaterThan(MIN_DISPLACEMENT_PX);

  return getDistanceFromBottom(page);
};

test('holds the scroll position when a live message arrives while scrolled up', async ({
  context,
  page,
}) => {
  await seedSession(context);
  const stub = await stubHomeserver(page, {
    timelineEvents: Array.from({ length: FILLER_COUNT }, (_unused, index) => textEvent(index)),
  });

  const distanceBeforeArrival = await openRoomScrolledUp(page);
  await startSamplingDistanceFromBottom(page);
  stub.pushTimeline([liveMessageEvent('$arrived', 'arrived while scrolled up')]);
  await page.waitForTimeout(SAMPLE_DURATION_MS);

  const samples = await collectSamples(page);
  expect(samples.length).toBeGreaterThan(0);
  expect(Math.min(...samples)).toBeGreaterThan(distanceBeforeArrival / 2);
});

test('keeps rendering live messages after a limited sync arrives while scrolled up', async ({
  context,
  page,
}) => {
  await seedSession(context);
  const stub = await stubHomeserver(page, {
    timelineEvents: Array.from({ length: FILLER_COUNT }, (_unused, index) => textEvent(index)),
  });

  await openRoomScrolledUp(page);
  stub.pushTimeline([liveMessageEvent('$arrived', 'arrived after a gap')], { isLimited: true });
  await page.waitForTimeout(SAMPLE_DURATION_MS);

  await page.locator(timelineScrollSelector).hover();
  await expect
    .poll(async () => {
      await page.mouse.wheel(0, SCROLL_UP_PX);
      return getDistanceFromBottom(page);
    })
    .toBeLessThan(LIVE_EDGE_TOLERANCE_PX);

  await expect(page.locator('[data-message-id="$arrived"]')).toBeVisible();
});

test('holds the scroll position when a limited sync arrives while scrolled up', async ({
  context,
  page,
}) => {
  await seedSession(context);
  const stub = await stubHomeserver(page, {
    timelineEvents: Array.from({ length: FILLER_COUNT }, (_unused, index) => textEvent(index)),
  });

  const distanceBeforeArrival = await openRoomScrolledUp(page);
  await startSamplingDistanceFromBottom(page);
  stub.pushTimeline([liveMessageEvent('$arrived', 'arrived after a gap')], { isLimited: true });
  await page.waitForTimeout(SAMPLE_DURATION_MS);

  const samples = await collectSamples(page);
  expect(samples.length).toBeGreaterThan(0);
  expect(Math.min(...samples)).toBeGreaterThan(distanceBeforeArrival / 2);
});

test('stays at the live edge when a first reaction lands on the newest message', async ({
  context,
  page,
}) => {
  await seedSession(context);
  const stub = await stubHomeserver(page, {
    timelineEvents: Array.from({ length: FILLER_COUNT }, (_unused, index) => textEvent(index)),
  });

  await openRoomAtLiveEdge(page);
  stub.pushTimeline([reactionEvent('$reaction', NEWEST_EVENT_ID, '👍')]);
  await expect(
    page.locator(`[data-message-id="${NEWEST_EVENT_ID}"]`).getByText('👍')
  ).toBeVisible();

  await expect.poll(() => getDistanceFromBottom(page)).toBeLessThan(STUCK_TO_BOTTOM_PX);
});

test('stays at the live edge when a first reaction lands on an older message', async ({
  context,
  page,
}) => {
  await seedSession(context);
  const stub = await stubHomeserver(page, {
    timelineEvents: Array.from({ length: FILLER_COUNT }, (_unused, index) => textEvent(index)),
  });

  await openRoomAtLiveEdge(page);
  stub.pushTimeline([reactionEvent('$reaction', OLDER_VISIBLE_EVENT_ID, '👍')]);
  await expect(
    page.locator(`[data-message-id="${OLDER_VISIBLE_EVENT_ID}"]`).getByText('👍')
  ).toBeVisible();

  await expect.poll(() => getDistanceFromBottom(page)).toBeLessThan(STUCK_TO_BOTTOM_PX);
});
