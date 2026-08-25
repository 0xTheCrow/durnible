import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';
import {
  seedSession,
  stubHomeserver,
  textEvent,
  replyEvent,
  TEST_ROOM_ID,
} from './fixtures/homeserver';
import { PAGINATION_LIMIT } from '../src/app/features/room/timeline/timelineState';

const roomPath = `/home/${encodeURIComponent(TEST_ROOM_ID)}/`;

const FILLER_COUNT = PAGINATION_LIMIT + 40;
const TARGET_INDEX = 5;
const TARGET_EVENT_ID = `$filler${TARGET_INDEX}`;

const AT_BOTTOM_TOLERANCE_PX = 4;
const SAMPLE_DURATION_MS = 2000;

type ScrollSample = {
  distanceFromBottom: number;
  targetRendered: boolean;
};

const startSampling = (page: Page) =>
  page.evaluate(
    ([targetEventId, durationMs]) => {
      const scrollElement = document.querySelector(
        '[data-testid="timeline-scroll"]'
      ) as HTMLElement;
      const samples: { distanceFromBottom: number; targetRendered: boolean }[] = [];
      const globalScope = window as unknown as { __replyJumpSamples: typeof samples };
      globalScope.__replyJumpSamples = samples;
      const startedAt = performance.now();
      const sample = () => {
        samples.push({
          distanceFromBottom:
            scrollElement.scrollHeight - scrollElement.scrollTop - scrollElement.clientHeight,
          targetRendered: !!scrollElement.querySelector(
            `[data-message-id="${CSS.escape(targetEventId as string)}"]`
          ),
        });
        if (performance.now() - startedAt < (durationMs as number)) {
          requestAnimationFrame(sample);
        }
      };
      requestAnimationFrame(sample);
    },
    [TARGET_EVENT_ID, SAMPLE_DURATION_MS] as const
  );

const collectSamples = (page: Page): Promise<ScrollSample[]> =>
  page.evaluate(
    () => (window as unknown as { __replyJumpSamples: ScrollSample[] }).__replyJumpSamples
  );

test('jumping to a replied-to message never paints the bottom of the loaded window', async ({
  context,
  page,
}) => {
  await seedSession(context);
  await stubHomeserver(page, {
    timelineEvents: [
      ...Array.from({ length: FILLER_COUNT }, (_unused, index) => textEvent(index)),
      replyEvent(0, TARGET_EVENT_ID),
    ],
  });
  await page.goto(roomPath);

  const replyChip = page.getByTestId('reply-chip');
  await expect(replyChip).toBeVisible();
  await expect(page.locator(`[data-message-id="${TARGET_EVENT_ID}"]`)).toHaveCount(0);

  await startSampling(page);
  await replyChip.click();
  await expect(page.locator(`[data-message-id="${TARGET_EVENT_ID}"]`)).toBeVisible();
  await page.waitForTimeout(SAMPLE_DURATION_MS);

  const samples = await collectSamples(page);
  const framesAtBottomWithTarget = samples.filter(
    (sample) => sample.targetRendered && sample.distanceFromBottom <= AT_BOTTOM_TOLERANCE_PX
  );

  expect(samples.length).toBeGreaterThan(0);
  expect(framesAtBottomWithTarget).toHaveLength(0);
});

const ANCHOR_OFFSET_FRACTION = 0.12;
const ANCHOR_OFFSET_TOLERANCE_PX = 8;

test('jumping to a replied-to message lands it at the anchor offset', async ({ context, page }) => {
  await seedSession(context);
  await stubHomeserver(page, {
    timelineEvents: [
      ...Array.from({ length: FILLER_COUNT }, (_unused, index) => textEvent(index)),
      replyEvent(0, TARGET_EVENT_ID),
    ],
  });
  await page.goto(roomPath);

  await page.getByTestId('reply-chip').click();
  await expect(page.locator(`[data-message-id="${TARGET_EVENT_ID}"]`)).toBeVisible();
  await page.waitForTimeout(SAMPLE_DURATION_MS);

  const landing = await page.evaluate((targetEventId) => {
    const scrollElement = document.querySelector('[data-testid="timeline-scroll"]') as HTMLElement;
    const targetElement = scrollElement.querySelector(
      `[data-message-id="${CSS.escape(targetEventId as string)}"]`
    ) as HTMLElement;
    return {
      offsetFromViewportTop:
        targetElement.getBoundingClientRect().top - scrollElement.getBoundingClientRect().top,
      viewportHeight: scrollElement.clientHeight,
    };
  }, TARGET_EVENT_ID);

  const expectedOffsetFromViewportTop = landing.viewportHeight * ANCHOR_OFFSET_FRACTION;
  expect(Math.abs(landing.offsetFromViewportTop - expectedOffsetFromViewportTop)).toBeLessThan(
    ANCHOR_OFFSET_TOLERANCE_PX
  );
});
