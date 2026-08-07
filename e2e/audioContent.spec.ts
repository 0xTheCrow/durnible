import { test, expect, type BrowserContext, type Page } from '@playwright/test';
import {
  audioEvent,
  AUDIO_DURATION_SECONDS,
  seedSession,
  stubHomeserver,
  TEST_ROOM_ID,
  type StubHomeserverOptions,
} from './fixtures/homeserver';
import { BASE_URL } from '../playwright.config';
import { VOICE_RECORDING_MIME_TYPE_CANDIDATES } from '../src/app/hooks/useVoiceRecording';

const roomPath = `/home/${encodeURIComponent(TEST_ROOM_ID)}/`;
const RECORDER_PAGE_PATH = '/e2e-recorder-blank';
const AUDIO_PLAYER_SELECTOR = '[data-testid="audio-player"]';
const REPLAY_START_TOLERANCE_SECONDS = 0.1;
const SEEKABLE_CLIP_SECONDS = 3;
const SEEK_TARGET_FRACTION = 0.75;

declare global {
  interface Window {
    playEventCount: number;
    lowestTimeAfterReplay: number;
  }
}

const playToggle = (page: Page) => page.getByTestId('audio-play-toggle');

const openRoom = async (context: BrowserContext, page: Page, options: StubHomeserverOptions) => {
  await seedSession(context);
  await stubHomeserver(page, options);
  await page.goto(roomPath);
};

const play = async (page: Page) => {
  const toggle = playToggle(page);
  await expect(toggle).toBeVisible();
  await toggle.click();
  await expect(toggle).toHaveAttribute('aria-pressed', 'true');
};

// CI runners have no audio output device, and Firefox drives an audio element's clock off a
// real one, so playback never advances to `ended` there. Local Firefox runs still cover this.
const NO_AUDIO_DEVICE_REASON = 'Firefox cannot advance playback without an audio output device';
const skipWhenPlaybackCannotFinish = (browserName: string) =>
  test.skip(browserName === 'firefox' && !!process.env.CI, NO_AUDIO_DEVICE_REASON);

const waitForPlaybackToEnd = async (page: Page) => {
  await page.waitForFunction((selector) => {
    const audio = document.querySelector(selector) as HTMLAudioElement | null;
    return audio !== null && audio.ended;
  }, AUDIO_PLAYER_SELECTOR);
};

const recordVoiceClip = async (
  context: BrowserContext,
  durationSeconds = AUDIO_DURATION_SECONDS
): Promise<{ body: Buffer; mimeType: string }> => {
  const recorderPage = await context.newPage();
  await recorderPage.route(`${BASE_URL}${RECORDER_PAGE_PATH}`, (route) =>
    route.fulfill({ status: 200, contentType: 'text/html', body: '<!doctype html><title>rec' })
  );
  await recorderPage.goto(`${BASE_URL}${RECORDER_PAGE_PATH}`);

  const recorded = await recorderPage.evaluate(
    async ({ durationMs, mimeTypeCandidates }) => {
      const audioContext = new AudioContext();
      const destination = audioContext.createMediaStreamDestination();
      const silence = audioContext.createGain();
      silence.gain.value = 0;
      silence.connect(destination);
      const oscillator = audioContext.createOscillator();
      oscillator.connect(silence);
      oscillator.start();

      const supportedMimeType = mimeTypeCandidates.find((candidate) =>
        MediaRecorder.isTypeSupported(candidate)
      );
      const recorder = new MediaRecorder(
        destination.stream,
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
      oscillator.stop();

      const mimeType = recorder.mimeType || supportedMimeType || '';
      const blob = new Blob(chunks, { type: mimeType });
      return {
        bytes: Array.from(new Uint8Array(await blob.arrayBuffer())),
        mimeType,
      };
    },
    {
      durationMs: durationSeconds * 1000,
      mimeTypeCandidates: VOICE_RECORDING_MIME_TYPE_CANDIDATES,
    }
  );

  await recorderPage.close();
  return { body: Buffer.from(recorded.bytes), mimeType: recorded.mimeType };
};

test('a single click after playback ends starts it again', async ({
  context,
  page,
  browserName,
}) => {
  skipWhenPlaybackCannotFinish(browserName);
  await openRoom(context, page, { timelineEvents: [audioEvent()] });
  await play(page);
  await waitForPlaybackToEnd(page);

  await page.evaluate((selector) => {
    window.playEventCount = 0;
    document.querySelector(selector)?.addEventListener('play', () => {
      window.playEventCount += 1;
    });
  }, AUDIO_PLAYER_SELECTOR);

  await playToggle(page).click();

  await expect.poll(() => page.evaluate(() => window.playEventCount)).toBeGreaterThan(0);
});

test('a recording with no container duration replays from the start', async ({
  context,
  page,
  browserName,
}) => {
  skipWhenPlaybackCannotFinish(browserName);
  const recording = await recordVoiceClip(context);
  await openRoom(context, page, {
    timelineEvents: [audioEvent(recording.mimeType)],
    audioResponse: { body: recording.body, contentType: recording.mimeType },
  });

  await play(page);
  await waitForPlaybackToEnd(page);

  await page.evaluate((selector) => {
    const audio = document.querySelector(selector) as HTMLAudioElement;
    window.lowestTimeAfterReplay = Number.POSITIVE_INFINITY;
    audio.addEventListener('timeupdate', () => {
      window.lowestTimeAfterReplay = Math.min(window.lowestTimeAfterReplay, audio.currentTime);
    });
  }, AUDIO_PLAYER_SELECTOR);

  await playToggle(page).click();

  await expect
    .poll(() => page.evaluate(() => window.lowestTimeAfterReplay))
    .toBeLessThan(REPLAY_START_TOLERANCE_SECONDS);
});

const currentPlaybackTime = (page: Page) =>
  page.evaluate((selector) => {
    const audio = document.querySelector(selector) as HTMLAudioElement | null;
    return audio?.currentTime ?? 0;
  }, AUDIO_PLAYER_SELECTOR);

test('clicking the seek track moves the playback position', async ({ context, page }) => {
  const recording = await recordVoiceClip(context, SEEKABLE_CLIP_SECONDS);
  await openRoom(context, page, {
    timelineEvents: [audioEvent(recording.mimeType, SEEKABLE_CLIP_SECONDS)],
    audioResponse: { body: recording.body, contentType: recording.mimeType },
  });

  const toggle = playToggle(page);
  await play(page);
  await toggle.click();
  await expect(toggle).toHaveAttribute('aria-pressed', 'false');

  const track = page.getByTestId('audio-seek-track');
  const trackBox = await track.boundingBox();
  if (!trackBox) throw new Error('seek track has no layout box');
  await track.click({
    position: { x: trackBox.width * SEEK_TARGET_FRACTION, y: trackBox.height / 2 },
  });

  await expect
    .poll(() => currentPlaybackTime(page))
    .toBeGreaterThan(SEEKABLE_CLIP_SECONDS * SEEK_TARGET_FRACTION * 0.8);
});
