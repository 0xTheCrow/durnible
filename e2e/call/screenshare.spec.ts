import { expect } from '@playwright/test';
import type { Page } from '@playwright/test';
import { Track } from 'livekit-client';
import {
  DEFAULT_SCREENSHARE_AUDIO_BITRATE_KBPS,
  DEFAULT_SCREENSHARE_MAX_FRAME_RATE,
  DEFAULT_SCREENSHARE_RESOLUTION,
  SCREENSHARE_AUDIO_BITRATE_KBPS_OPTIONS,
  SCREENSHARE_MAX_FRAME_RATE_OPTIONS,
  SCREENSHARE_RESOLUTION_OPTIONS,
  getScreenshareAudioPreset,
  getScreenshareEncoding,
} from '../../src/app/plugins/call/screenshare';
import type {
  ScreenshareAudioBitrateKbps,
  ScreenshareMaxFrameRate,
  ScreenshareResolution,
} from '../../src/app/state/settings';
import { CALL_TEST_USERS } from '../fixtures/callHomeserver';
import type { CallClient } from '../fixtures/call';
import {
  MEDIA_FLOW_TIMEOUT_MS,
  callTest as test,
  expectToKeepGrowing,
  getCallTile,
  getParticipantAudio,
  joinVoiceRoom,
  readDecodedFrameCount,
  readLocalSender,
  readReceivedBytes,
} from '../fixtures/call';

const findNonDefaultOption = <Option>(options: Option[], defaultOption: Option): Option => {
  const option = options.find((candidate) => candidate !== defaultOption);
  if (option === undefined) throw new Error('every option is the default');
  return option;
};

type ScreenshareQuality = {
  resolution: ScreenshareResolution;
  maxFrameRate: ScreenshareMaxFrameRate;
  audioBitrateKbps: ScreenshareAudioBitrateKbps;
};

const NON_DEFAULT_QUALITY: ScreenshareQuality = {
  resolution: findNonDefaultOption(SCREENSHARE_RESOLUTION_OPTIONS, DEFAULT_SCREENSHARE_RESOLUTION),
  maxFrameRate: findNonDefaultOption(
    SCREENSHARE_MAX_FRAME_RATE_OPTIONS,
    DEFAULT_SCREENSHARE_MAX_FRAME_RATE
  ),
  audioBitrateKbps: findNonDefaultOption(
    SCREENSHARE_AUDIO_BITRATE_KBPS_OPTIONS,
    DEFAULT_SCREENSHARE_AUDIO_BITRATE_KBPS
  ),
};

const startScreenshare = async (client: CallClient): Promise<void> => {
  await client.page.getByTestId('call-screenshare-toggle').click();
  await expect
    .poll(
      async () =>
        (
          await readLocalSender(client.page, { kind: 'video', origin: 'displayCapture' })
        )?.trackId,
      {
        timeout: MEDIA_FLOW_TIMEOUT_MS,
      }
    )
    .toBeDefined();
};

const readScreenshareSenders = async (page: Page) => ({
  video: await readLocalSender(page, { kind: 'video', origin: 'displayCapture' }),
  audio: await readLocalSender(page, { kind: 'audio', origin: 'displayCapture' }),
});

const expectSendersToMatchQuality = async (page: Page, quality: ScreenshareQuality) => {
  const expectedVideoEncoding = getScreenshareEncoding(quality.resolution, quality.maxFrameRate);
  const expectedAudioMaxBitrate = getScreenshareAudioPreset(quality.audioBitrateKbps).maxBitrate;
  await expect
    .poll(async () => {
      const { video, audio } = await readScreenshareSenders(page);
      return {
        hasVideoEncoding:
          video?.encodings.some(
            (encoding) =>
              encoding.maxBitrate === expectedVideoEncoding.maxBitrate &&
              encoding.maxFramerate === expectedVideoEncoding.maxFramerate
          ) ?? false,
        audioMaxBitrates: audio?.encodings.map((encoding) => encoding.maxBitrate) ?? [],
      };
    })
    .toEqual({ hasVideoEncoding: true, audioMaxBitrates: [expectedAudioMaxBitrate] });
};

const chooseQualityOption = async (page: Page, optionTestId: string, value: string | number) => {
  await page.getByTestId('screenshare-quality-menu').click();
  await page.locator(`[data-testid="${optionTestId}"][data-value="${value}"]`).click();
};

test("a screenshare plays in the other participant's spotlight until it stops", async ({
  callSession,
}) => {
  const [voiceRoomId] = callSession.homeserver.voiceRoomIds;
  const bob = await callSession.openClient(CALL_TEST_USERS.bob);
  const alice = await callSession.openClient(CALL_TEST_USERS.alice);
  await joinVoiceRoom(bob.page, voiceRoomId);
  await joinVoiceRoom(alice.page, voiceRoomId);
  const aliceScreenOnBob = bob.page
    .getByTestId('call-spotlight')
    .locator(getCallTile(bob.page, alice.user.userId, Track.Source.ScreenShare))
    .getByTestId('call-tile-video');

  await startScreenshare(alice);

  await expect(aliceScreenOnBob).toBeVisible({ timeout: MEDIA_FLOW_TIMEOUT_MS });
  await expectToKeepGrowing(() => readDecodedFrameCount(aliceScreenOnBob));

  await alice.page.getByTestId('call-screenshare-toggle').click();

  await expect(bob.page.getByTestId('call-spotlight')).toBeHidden({
    timeout: MEDIA_FLOW_TIMEOUT_MS,
  });
});

test('screenshare audio is captured without voice processing and reaches the other participant', async ({
  callSession,
}) => {
  const [voiceRoomId] = callSession.homeserver.voiceRoomIds;
  const bob = await callSession.openClient(CALL_TEST_USERS.bob);
  const alice = await callSession.openClient(CALL_TEST_USERS.alice);
  await joinVoiceRoom(bob.page, voiceRoomId);
  await joinVoiceRoom(alice.page, voiceRoomId);

  await startScreenshare(alice);

  const screenshareAudio = await readLocalSender(alice.page, {
    kind: 'audio',
    origin: 'displayCapture',
  });
  expect(screenshareAudio?.trackSettings).toMatchObject({
    echoCancellation: false,
    noiseSuppression: false,
    autoGainControl: false,
  });
  await expectToKeepGrowing(() =>
    readReceivedBytes(
      getParticipantAudio(bob.page, alice.user.userId, Track.Source.ScreenShareAudio)
    )
  );
});

test('a screenshare publishes with the stored quality settings', async ({ callSession }) => {
  const [voiceRoomId] = callSession.homeserver.voiceRoomIds;
  const alice = await callSession.openClient(CALL_TEST_USERS.alice, {
    settings: {
      screenshareResolution: NON_DEFAULT_QUALITY.resolution,
      screenshareMaxFrameRate: NON_DEFAULT_QUALITY.maxFrameRate,
      screenshareAudioBitrateKbps: NON_DEFAULT_QUALITY.audioBitrateKbps,
    },
  });
  await joinVoiceRoom(alice.page, voiceRoomId);

  await startScreenshare(alice);

  await expectSendersToMatchQuality(alice.page, NON_DEFAULT_QUALITY);
});

test('changing quality during a screenshare updates the live senders', async ({ callSession }) => {
  const [voiceRoomId] = callSession.homeserver.voiceRoomIds;
  const alice = await callSession.openClient(CALL_TEST_USERS.alice);
  await joinVoiceRoom(alice.page, voiceRoomId);
  await startScreenshare(alice);
  const sendersBeforeChange = await readScreenshareSenders(alice.page);
  await getCallTile(alice.page, alice.user.userId).click();

  await chooseQualityOption(
    alice.page,
    'screenshare-resolution-option',
    NON_DEFAULT_QUALITY.resolution
  );
  await chooseQualityOption(
    alice.page,
    'screenshare-frame-rate-option',
    NON_DEFAULT_QUALITY.maxFrameRate
  );
  await chooseQualityOption(
    alice.page,
    'screenshare-audio-bitrate-option',
    NON_DEFAULT_QUALITY.audioBitrateKbps
  );

  await expectSendersToMatchQuality(alice.page, NON_DEFAULT_QUALITY);
  const sendersAfterChange = await readScreenshareSenders(alice.page);
  expect(sendersAfterChange.video?.trackId).toBe(sendersBeforeChange.video?.trackId);
  expect(sendersAfterChange.audio?.trackId).toBe(sendersBeforeChange.audio?.trackId);
});
