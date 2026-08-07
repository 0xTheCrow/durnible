import { test, expect, type BrowserContext, type Page } from '@playwright/test';
import {
  seedSession,
  stubHomeserver,
  textEvent,
  videoEvent,
  VIDEO_DURATION_SECONDS,
  VIDEO_HEIGHT,
  VIDEO_WIDTH,
  TEST_ROOM_ID,
  type StubHomeserverOptions,
} from './fixtures/homeserver';
import { BASE_URL } from '../playwright.config';

const roomPath = `/home/${encodeURIComponent(TEST_ROOM_ID)}/`;
const RECORDER_PAGE_PATH = '/e2e-video-recorder-blank';
const VIDEO_PLAYER_SELECTOR = '[data-testid="video-player"]';
const TIMELINE_SCROLL_SELECTOR = '[data-testid="timeline-scroll"]';
const VIDEO_MIME_TYPE_CANDIDATES = ['video/webm;codecs=vp8', 'video/webm;codecs=vp9', 'video/webm'];
const FILLER_MESSAGE_COUNT = 40;
const CAPTURE_FRAMES_PER_SECOND = 30;
const UNENDING_CLIP_SECONDS = 8;

const openRoom = async (context: BrowserContext, page: Page, options: StubHomeserverOptions) => {
  await seedSession(context);
  await stubHomeserver(page, options);
  await page.goto(roomPath);
};

const watch = async (page: Page) => {
  const watchButton = page.getByTestId('video-content-watch-btn');
  await expect(watchButton).toBeVisible();
  await watchButton.click();
};

const readVideoState = (page: Page) =>
  page.evaluate((selector) => {
    const video = document.querySelector(selector) as HTMLVideoElement | null;
    if (!video) return null;
    return {
      isDecoded: video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA,
      currentTime: video.currentTime,
      isPaused: video.paused,
      hasEnded: video.ended,
    };
  }, VIDEO_PLAYER_SELECTOR);

const waitForPlaybackToStart = async (page: Page) => {
  await expect
    .poll(() => readVideoState(page).then((state) => state?.currentTime ?? 0))
    .toBeGreaterThan(0);
};

const recordVideoClip = async (
  context: BrowserContext,
  durationSeconds = VIDEO_DURATION_SECONDS
): Promise<{ body: Buffer; mimeType: string }> => {
  const recorderPage = await context.newPage();
  await recorderPage.route(`${BASE_URL}${RECORDER_PAGE_PATH}`, (route) =>
    route.fulfill({ status: 200, contentType: 'text/html', body: '<!doctype html><title>rec' })
  );
  await recorderPage.goto(`${BASE_URL}${RECORDER_PAGE_PATH}`);

  const recorded = await recorderPage.evaluate(
    async ({ durationMs, mimeTypeCandidates, width, height, framesPerSecond }) => {
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const drawingContext = canvas.getContext('2d');
      if (!drawingContext) throw new Error('canvas 2d context unavailable');

      let frameCount = 0;
      const drawFrame = () => {
        frameCount += 1;
        drawingContext.fillStyle = frameCount % 2 === 0 ? '#ff0000' : '#0000ff';
        drawingContext.fillRect(0, 0, width, height);
      };
      drawFrame();
      const drawTimer = setInterval(drawFrame, 1000 / framesPerSecond);

      const supportedMimeType = mimeTypeCandidates.find((candidate) =>
        MediaRecorder.isTypeSupported(candidate)
      );
      const recorder = new MediaRecorder(
        canvas.captureStream(framesPerSecond),
        supportedMimeType ? { mimeType: supportedMimeType } : undefined
      );
      const chunks: Blob[] = [];
      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) chunks.push(event.data);
      };
      await new Promise<void>((resolve) => {
        recorder.onstop = () => resolve();
        recorder.start();
        setTimeout(() => recorder.stop(), durationMs);
      });
      clearInterval(drawTimer);

      const mimeType = recorder.mimeType || supportedMimeType || '';
      const blob = new Blob(chunks, { type: mimeType });
      return {
        bytes: Array.from(new Uint8Array(await blob.arrayBuffer())),
        mimeType,
      };
    },
    {
      durationMs: durationSeconds * 1000,
      mimeTypeCandidates: VIDEO_MIME_TYPE_CANDIDATES,
      width: VIDEO_WIDTH,
      height: VIDEO_HEIGHT,
      framesPerSecond: CAPTURE_FRAMES_PER_SECOND,
    }
  );

  await recorderPage.close();
  return { body: Buffer.from(recorded.bytes), mimeType: recorded.mimeType };
};

test('an embedded video decodes and advances once watched', async ({ context, page }) => {
  const clip = await recordVideoClip(context);
  await openRoom(context, page, {
    timelineEvents: [videoEvent(clip.mimeType)],
    videoResponse: { body: clip.body, contentType: clip.mimeType },
  });

  await watch(page);

  await expect
    .poll(() => readVideoState(page).then((state) => state?.isDecoded ?? false))
    .toBe(true);
  await waitForPlaybackToStart(page);
});

test('scrolling the video out of view pauses it', async ({ context, page }) => {
  const clip = await recordVideoClip(context, UNENDING_CLIP_SECONDS);
  const fillerEvents = Array.from({ length: FILLER_MESSAGE_COUNT }, (_, index) => textEvent(index));
  await openRoom(context, page, {
    timelineEvents: [...fillerEvents, videoEvent(clip.mimeType)],
    videoResponse: { body: clip.body, contentType: clip.mimeType },
  });

  await watch(page);
  await waitForPlaybackToStart(page);

  await page.evaluate((selector) => {
    const scrollElement = document.querySelector(selector);
    if (!scrollElement) throw new Error('timeline scroll container not found');
    scrollElement.scrollTop = 0;
  }, TIMELINE_SCROLL_SELECTOR);

  await expect
    .poll(() => readVideoState(page).then((state) => state?.isPaused && !state.hasEnded))
    .toBe(true);
});

test('a media body the element cannot decode surfaces the retry control', async ({
  context,
  page,
}) => {
  await openRoom(context, page, {
    timelineEvents: [videoEvent()],
    videoResponse: { body: Buffer.from('this is not a video'), contentType: 'text/plain' },
  });

  await watch(page);

  await expect(page.getByTestId('video-content-retry-btn')).toBeVisible();
});
