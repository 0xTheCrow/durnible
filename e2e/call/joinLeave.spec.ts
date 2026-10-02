import { expect } from '@playwright/test';
import { CALL_MEMBER_EVENT_TYPE, CALL_TEST_USERS } from '../fixtures/callHomeserver';
import type { SentStateEvent } from '../fixtures/callHomeserver';
import {
  MEDIA_FLOW_TIMEOUT_MS,
  callTest as test,
  expectToKeepGrowing,
  getVoiceRoomEntry,
  joinVoiceRoom,
  readLocalSender,
  readOpenPeerConnectionCount,
} from '../fixtures/call';

const findLatestCallMembership = (
  sentStateEvents: SentStateEvent[],
  roomId: string,
  userId: string
): SentStateEvent | undefined =>
  sentStateEvents.findLast(
    (event) =>
      event.roomId === roomId &&
      event.sender === userId &&
      event.eventType === CALL_MEMBER_EVENT_TYPE
  );

test('joining from the voice room entry opens the pane and publishes the microphone', async ({
  callSession,
}) => {
  const { homeserver } = callSession;
  const [voiceRoomId] = homeserver.voiceRoomIds;
  const alice = await callSession.openClient(CALL_TEST_USERS.alice);

  await joinVoiceRoom(alice.page, voiceRoomId);

  await expect(alice.page.getByTestId('call-pane')).toBeVisible();
  const membership = findLatestCallMembership(
    homeserver.sentStateEvents,
    voiceRoomId,
    alice.user.userId
  );
  expect(membership?.content).toMatchObject({ device_id: alice.user.deviceId });
  await expectToKeepGrowing(
    async () =>
      (await readLocalSender(alice.page, { kind: 'audio', origin: 'other' }))?.bytesSent ?? 0
  );
});

test('leaving closes the pane, clears the membership and closes the media connections', async ({
  callSession,
}) => {
  const { homeserver } = callSession;
  const [voiceRoomId] = homeserver.voiceRoomIds;
  const alice = await callSession.openClient(CALL_TEST_USERS.alice);
  await joinVoiceRoom(alice.page, voiceRoomId);

  await alice.page.getByTestId('call-leave').click();

  await expect(alice.page.getByTestId('call-pane')).toBeHidden();
  await expect(getVoiceRoomEntry(alice.page, voiceRoomId)).toHaveAttribute(
    'data-call-entry-status',
    'idle'
  );
  await expect
    .poll(
      () =>
        findLatestCallMembership(homeserver.sentStateEvents, voiceRoomId, alice.user.userId)
          ?.content
    )
    .toEqual({});
  await expect.poll(() => readOpenPeerConnectionCount(alice.page)).toBe(0);
});

test('a failed join shows the failure on the entry, and clicking again joins', async ({
  callSession,
}) => {
  const { homeserver } = callSession;
  const [voiceRoomId] = homeserver.voiceRoomIds;
  const alice = await callSession.openClient(CALL_TEST_USERS.alice);
  const voiceRoomEntry = getVoiceRoomEntry(alice.page, voiceRoomId);
  homeserver.setIsSfuServiceAvailable(false);

  await voiceRoomEntry.click();

  await expect(voiceRoomEntry).toHaveAttribute('data-call-entry-status', 'failed', {
    timeout: MEDIA_FLOW_TIMEOUT_MS,
  });
  await expect(alice.page.getByTestId('call-pane')).toBeHidden();

  homeserver.setIsSfuServiceAvailable(true);
  await joinVoiceRoom(alice.page, voiceRoomId);
  await expect(alice.page.getByTestId('call-pane')).toBeVisible();
});

test('joining a second voice room leaves the first', async ({ callSession }) => {
  const { homeserver } = callSession;
  const [firstVoiceRoomId, secondVoiceRoomId] = homeserver.voiceRoomIds;
  const alice = await callSession.openClient(CALL_TEST_USERS.alice);
  await joinVoiceRoom(alice.page, firstVoiceRoomId);

  await joinVoiceRoom(alice.page, secondVoiceRoomId);

  await expect(getVoiceRoomEntry(alice.page, firstVoiceRoomId)).toHaveAttribute(
    'data-call-entry-status',
    'idle'
  );
  await expect
    .poll(
      () =>
        findLatestCallMembership(homeserver.sentStateEvents, firstVoiceRoomId, alice.user.userId)
          ?.content
    )
    .toEqual({});
  expect(
    findLatestCallMembership(homeserver.sentStateEvents, secondVoiceRoomId, alice.user.userId)
      ?.content
  ).toMatchObject({ device_id: alice.user.deviceId });
});
