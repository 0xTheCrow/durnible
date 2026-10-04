import { expect } from '@playwright/test';
import { Track } from 'livekit-client';
import {
  CALL_VOLUME_LEVEL_DEFAULT,
  CALL_VOLUME_LEVEL_STEP,
} from '../../src/app/state/callVolumePreferences';
import {
  MEDIA_FLOW_TIMEOUT_MS,
  callTest as test,
  connectBobThenAlice,
  expectToKeepGrowing,
  getCallTile,
  getParticipantAudio,
  getVoiceRoomParticipant,
  joinVoiceRoom,
  pressRepeatedly,
  readDecodedFrameCount,
  readReceivedBytes,
} from '../fixtures/call';

const VOLUME_STEPS_DOWN = 25;

test('a participant joining shows up for the other with their audio, and leaving removes them', async ({
  callSession,
}) => {
  const { alice, bob } = await connectBobThenAlice(callSession);
  const aliceUserId = alice.user.userId;

  await expect(getVoiceRoomParticipant(bob.page, aliceUserId)).toBeVisible();
  await expectToKeepGrowing(() =>
    readReceivedBytes(getParticipantAudio(bob.page, aliceUserId, Track.Source.Microphone))
  );

  await alice.page.getByTestId('call-leave').click();

  await expect(getCallTile(bob.page, aliceUserId)).toBeHidden({ timeout: MEDIA_FLOW_TIMEOUT_MS });
  await expect(getVoiceRoomParticipant(bob.page, aliceUserId)).toBeHidden();
});

test('muting the microphone shows as muted to the other participant', async ({ callSession }) => {
  const { alice, bob } = await connectBobThenAlice(callSession);
  const aliceTileOnBob = getCallTile(bob.page, alice.user.userId);
  const aliceNavEntryOnBob = getVoiceRoomParticipant(bob.page, alice.user.userId);

  await alice.page.getByTestId('call-microphone-toggle').click();

  await expect(aliceTileOnBob.getByTestId('call-tile-microphone-muted')).toBeVisible();
  await expect(
    aliceNavEntryOnBob.getByTestId('voice-room-participant-microphone-muted')
  ).toBeVisible();

  await alice.page.getByTestId('call-microphone-toggle').click();

  await expect(aliceTileOnBob.getByTestId('call-tile-microphone-muted')).toBeHidden();
  await expect(
    aliceNavEntryOnBob.getByTestId('voice-room-participant-microphone-muted')
  ).toBeHidden();
});

test('deafening silences incoming audio and the microphone, and undeafening restores both', async ({
  callSession,
}) => {
  const { alice, bob } = await connectBobThenAlice(callSession);
  const aliceAudioOnBob = getParticipantAudio(bob.page, alice.user.userId, Track.Source.Microphone);
  const bobMutedOnAlice = getCallTile(alice.page, bob.user.userId).getByTestId(
    'call-tile-microphone-muted'
  );

  await bob.page.getByTestId('call-deafen-toggle').click();

  await expect(aliceAudioOnBob).toHaveJSProperty('muted', true);
  await expect(bobMutedOnAlice).toBeVisible();

  await bob.page.getByTestId('call-deafen-toggle').click();

  await expect(aliceAudioOnBob).toHaveJSProperty('muted', false);
  await expect(bobMutedOnAlice).toBeHidden();
});

test('undeafening keeps a microphone muted that was muted before deafening', async ({
  callSession,
}) => {
  const { alice, bob } = await connectBobThenAlice(callSession);
  const aliceAudioOnBob = getParticipantAudio(bob.page, alice.user.userId, Track.Source.Microphone);
  const bobMicrophoneToggle = bob.page.getByTestId('call-microphone-toggle');
  const bobMutedOnAlice = getCallTile(alice.page, bob.user.userId).getByTestId(
    'call-tile-microphone-muted'
  );
  await bobMicrophoneToggle.click();
  await expect(bobMutedOnAlice).toBeVisible();

  await bob.page.getByTestId('call-deafen-toggle').click();
  await expect(aliceAudioOnBob).toHaveJSProperty('muted', true);
  await bob.page.getByTestId('call-deafen-toggle').click();

  await expect(aliceAudioOnBob).toHaveJSProperty('muted', false);
  await expect(bobMicrophoneToggle).toHaveAttribute('aria-pressed', 'true');
  await expect(bobMutedOnAlice).toBeVisible();
});

test('a per-user volume applies to that participant and survives rejoining', async ({
  callSession,
}) => {
  const { alice, bob, voiceRoomId } = await connectBobThenAlice(callSession);
  const expectedVolumeLevel =
    CALL_VOLUME_LEVEL_DEFAULT *
    (CALL_VOLUME_LEVEL_DEFAULT - VOLUME_STEPS_DOWN * CALL_VOLUME_LEVEL_STEP);
  const readAliceVolumeOnBob = () =>
    getParticipantAudio(bob.page, alice.user.userId, Track.Source.Microphone).evaluate(
      (element) => (element as HTMLAudioElement).volume
    );

  await getCallTile(bob.page, alice.user.userId).click({ button: 'right' });
  const volumeSlider = bob.page.getByTestId('call-user-volume-slider');
  await volumeSlider.focus();
  await pressRepeatedly(volumeSlider, 'ArrowLeft', VOLUME_STEPS_DOWN);
  await bob.page.keyboard.press('Escape');

  await expect.poll(readAliceVolumeOnBob).toBeCloseTo(expectedVolumeLevel, 2);

  await bob.page.getByTestId('call-leave').click();
  await joinVoiceRoom(bob.page, voiceRoomId);

  await expect.poll(readAliceVolumeOnBob).toBeCloseTo(expectedVolumeLevel, 2);
});

test('a camera shows as playing video to the other participant until turned off', async ({
  callSession,
}) => {
  const { alice, bob } = await connectBobThenAlice(callSession);
  const aliceVideoOnBob = getCallTile(bob.page, alice.user.userId).getByTestId('call-tile-video');

  await alice.page.getByTestId('call-camera-toggle').click();

  await expect(aliceVideoOnBob).toBeVisible({ timeout: MEDIA_FLOW_TIMEOUT_MS });
  await expectToKeepGrowing(() => readDecodedFrameCount(aliceVideoOnBob));

  await alice.page.getByTestId('call-camera-toggle').click();

  await expect(aliceVideoOnBob).toBeHidden({ timeout: MEDIA_FLOW_TIMEOUT_MS });
});
