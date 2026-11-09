import { expect } from '@playwright/test';
import type { Page, WebSocketRoute } from '@playwright/test';
import { Track } from 'livekit-client';
import { CALL_TEST_USERS } from '../../fixtures/callHomeserver';
import { LIVEKIT_URL } from '../../fixtures/livekitServer';
import type { CallClient, CallSession } from '../../fixtures/call';
import {
  MEDIA_FLOW_TIMEOUT_MS,
  callTest as test,
  getCallTile,
  getVoiceRoomEntry,
  joinVoiceRoom,
  toggleScreenshare,
  watchScreenshare,
} from '../../fixtures/call';

const BYTES_SAMPLE_WINDOW_MS = 500;
const FLOW_POLL_INTERVAL_MS = 100;
const UNWATCHED_OBSERVATION_SAMPLES = 4;
const WALK_REPETITIONS = 3;
const WALK_TEST_TIMEOUT_MS = 120_000;
const RAPID_SWITCH_COUNT = 20;

type ScreenshareAudioReceivers = {
  bytesByTrackId: Record<string, number>;
  negotiatedCount: number;
};

type ScreenshareAudioFlow = {
  watchedUserIds: string[];
  unwatchedReceivingCount: number;
  watchedNotReceivingCount: number;
};

const readScreenshareAudioReceivers = (page: Page): Promise<ScreenshareAudioReceivers> =>
  page.evaluate(
    async ({ microphoneSource }) => {
      const probe = window.durnibleE2eMediaProbe;
      if (!probe) throw new Error('media probe not installed');
      const microphoneTrackIds = new Set(
        Array.from(
          document.querySelectorAll<HTMLAudioElement>(
            `[data-testid="call-participant-audio"][data-track-source="${microphoneSource}"]`
          )
        ).flatMap((element) =>
          element.srcObject instanceof MediaStream
            ? element.srcObject.getAudioTracks().map((track) => track.id)
            : []
        )
      );
      const transceivers = probe.peerConnections
        .filter((peerConnection) => peerConnection.connectionState !== 'closed')
        .flatMap((peerConnection) => peerConnection.getTransceivers())
        .filter(
          ({ receiver }) =>
            receiver.track.kind === 'audio' && !microphoneTrackIds.has(receiver.track.id)
        );
      const bytesByTrackId: Record<string, number> = {};
      await Promise.all(
        transceivers.map(async ({ receiver }) => {
          let bytesReceived = 0;
          (await receiver.getStats()).forEach((report) => {
            if (report.type === 'inbound-rtp') bytesReceived += report.bytesReceived ?? 0;
          });
          bytesByTrackId[receiver.track.id] = bytesReceived;
        })
      );
      return {
        bytesByTrackId,
        negotiatedCount: transceivers.filter(
          (transceiver) => transceiver.currentDirection === 'recvonly'
        ).length,
      };
    },
    { microphoneSource: Track.Source.Microphone }
  );

const readWatchedScreenshareAudio = (page: Page): Promise<{ userId: string; trackId: string }[]> =>
  page.evaluate(
    ({ screenshareAudioSource }) =>
      Array.from(
        document.querySelectorAll<HTMLAudioElement>(
          `[data-testid="call-participant-audio"][data-track-source="${screenshareAudioSource}"]`
        )
      ).flatMap((element) =>
        element.srcObject instanceof MediaStream
          ? element.srcObject
              .getAudioTracks()
              .map((track) => ({ userId: element.dataset.userId ?? '', trackId: track.id }))
          : []
      ),
    { screenshareAudioSource: Track.Source.ScreenShareAudio }
  );

const readScreenshareAudioFlow = async (page: Page): Promise<ScreenshareAudioFlow> => {
  const { bytesByTrackId: bytesBefore } = await readScreenshareAudioReceivers(page);
  await page.waitForTimeout(BYTES_SAMPLE_WINDOW_MS);
  const { bytesByTrackId: bytesAfter } = await readScreenshareAudioReceivers(page);
  const watched = await readWatchedScreenshareAudio(page);
  const watchedTrackIds = new Set(watched.map(({ trackId }) => trackId));
  const receivingTrackIds = Object.keys(bytesAfter).filter(
    (trackId) => trackId in bytesBefore && bytesAfter[trackId] > bytesBefore[trackId]
  );
  return {
    watchedUserIds: watched.map(({ userId }) => userId).sort(),
    unwatchedReceivingCount: receivingTrackIds.filter((trackId) => !watchedTrackIds.has(trackId))
      .length,
    watchedNotReceivingCount: [...watchedTrackIds].filter(
      (trackId) => !receivingTrackIds.includes(trackId)
    ).length,
  };
};

const expectScreenshareAudioFlow = (viewer: CallClient, flow: ScreenshareAudioFlow) =>
  expect
    .poll(() => readScreenshareAudioFlow(viewer.page), {
      timeout: MEDIA_FLOW_TIMEOUT_MS,
      intervals: [FLOW_POLL_INTERVAL_MS],
    })
    .toEqual(flow);

const expectScreenshareAudioFromOnly = (viewer: CallClient, watchedSharers: CallClient[]) =>
  expectScreenshareAudioFlow(viewer, {
    watchedUserIds: watchedSharers.map((sharer) => sharer.user.userId).sort(),
    unwatchedReceivingCount: 0,
    watchedNotReceivingCount: 0,
  });

const expectScreenshareAudioToStopAndStayStopped = async (
  viewer: CallClient,
  sharerCount: number
): Promise<void> => {
  await expect
    .poll(async () => (await readScreenshareAudioReceivers(viewer.page)).negotiatedCount, {
      timeout: MEDIA_FLOW_TIMEOUT_MS,
    })
    .toBe(sharerCount);
  await expectScreenshareAudioFromOnly(viewer, []);
  const flows = await Array.from({ length: UNWATCHED_OBSERVATION_SAMPLES }).reduce<
    Promise<ScreenshareAudioFlow[]>
  >(
    async (previousFlows) => [
      ...(await previousFlows),
      await readScreenshareAudioFlow(viewer.page),
    ],
    Promise.resolve([])
  );
  expect(flows.map((flow) => flow.unwatchedReceivingCount)).toEqual(flows.map(() => 0));
};

const readPeerConnectionCount = (page: Page): Promise<number> =>
  page.evaluate(() => {
    const probe = window.durnibleE2eMediaProbe;
    if (!probe) throw new Error('media probe not installed');
    return probe.peerConnections.length;
  });

const clickSharerTile = (viewer: CallClient, sharer: CallClient): Promise<void> =>
  getCallTile(viewer.page, sharer.user.userId).click();

const stopWatching = (viewer: CallClient): Promise<void> =>
  viewer.page.getByTestId('call-spotlight-stop-watching').click();

type CallWithTwoSharers = { viewer: CallClient; alice: CallClient; carol: CallClient };

const joinCallWithTwoSharers = async (
  callSession: CallSession,
  prepareViewer?: (viewer: CallClient) => Promise<void>
): Promise<CallWithTwoSharers> => {
  const [voiceRoomId] = callSession.homeserver.voiceRoomIds;
  const viewer = await callSession.openClient(CALL_TEST_USERS.bob);
  const alice = await callSession.openClient(CALL_TEST_USERS.alice);
  const carol = await callSession.openClient(CALL_TEST_USERS.carol);
  await prepareViewer?.(viewer);
  await joinVoiceRoom(viewer.page, voiceRoomId);
  await joinVoiceRoom(alice.page, voiceRoomId);
  await joinVoiceRoom(carol.page, voiceRoomId);
  await Promise.all([toggleScreenshare(alice), toggleScreenshare(carol)]);
  await Promise.all(
    [alice, carol].map((sharer) =>
      expect(
        getCallTile(viewer.page, sharer.user.userId).getByTestId('call-tile-sharing-badge')
      ).toBeVisible({ timeout: MEDIA_FLOW_TIMEOUT_MS })
    )
  );
  return { viewer, alice, carol };
};

type SharerName = 'alice' | 'carol';
type ViewerAction =
  | { kind: 'watch'; sharer: SharerName }
  | { kind: 'stopWatching' }
  | { kind: 'toggleOffFocusedTile' };

const watch = (sharer: SharerName): ViewerAction => ({ kind: 'watch', sharer });
const STOP_WATCHING: ViewerAction = { kind: 'stopWatching' };
const TOGGLE_OFF_FOCUSED_TILE: ViewerAction = { kind: 'toggleOffFocusedTile' };

const TRANSITION_COVERING_WALK: ViewerAction[] = [
  watch('alice'),
  watch('carol'),
  watch('alice'),
  STOP_WATCHING,
  watch('carol'),
  TOGGLE_OFF_FOCUSED_TILE,
  watch('alice'),
  TOGGLE_OFF_FOCUSED_TILE,
  watch('carol'),
  STOP_WATCHING,
];

test('screenshare audio is not streamed while unwatched, including after the sharer restarts', async ({
  callSession,
}) => {
  const { viewer, alice } = await joinCallWithTwoSharers(callSession);

  await expectScreenshareAudioToStopAndStayStopped(viewer, 2);
  await watchScreenshare(viewer, alice);
  await expectScreenshareAudioFromOnly(viewer, [alice]);

  await toggleScreenshare(alice);
  await expect(viewer.page.getByTestId('call-spotlight')).toBeHidden({
    timeout: MEDIA_FLOW_TIMEOUT_MS,
  });
  await toggleScreenshare(alice);
  await expectScreenshareAudioToStopAndStayStopped(viewer, 2);
  await watchScreenshare(viewer, alice);
  await expectScreenshareAudioFromOnly(viewer, [alice]);
});

test('screenshare audio follows the watched stream across every watch, switch and exit', async ({
  callSession,
}) => {
  test.setTimeout(WALK_TEST_TIMEOUT_MS);
  const call = await joinCallWithTwoSharers(callSession);
  const { viewer } = call;
  const sharerByName = { alice: call.alice, carol: call.carol };

  const performAction = async (
    watching: SharerName | undefined,
    action: ViewerAction
  ): Promise<SharerName | undefined> => {
    if (action.kind === 'watch') await clickSharerTile(viewer, sharerByName[action.sharer]);
    if (action.kind === 'stopWatching') await stopWatching(viewer);
    if (action.kind === 'toggleOffFocusedTile' && watching) {
      await clickSharerTile(viewer, sharerByName[watching]);
    }
    const nextWatching = action.kind === 'watch' ? action.sharer : undefined;
    await expectScreenshareAudioFromOnly(viewer, nextWatching ? [sharerByName[nextWatching]] : []);
    return nextWatching;
  };

  const repeatedWalk = Array.from({ length: WALK_REPETITIONS }).flatMap(
    () => TRANSITION_COVERING_WALK
  );
  await repeatedWalk.reduce<Promise<SharerName | undefined>>(
    async (previousAction, action) => performAction(await previousAction, action),
    Promise.resolve(undefined)
  );
});

test('rapid switching between streams settles on the last one watched', async ({ callSession }) => {
  const { viewer, alice, carol } = await joinCallWithTwoSharers(callSession);

  await viewer.page.evaluate(
    async ({ userIds, switchCount, videoSource }) => {
      const clickTile = (userId: string) =>
        document
          .querySelector<HTMLButtonElement>(
            `[data-testid="call-tile"][data-user-id="${userId}"][data-video-source="${videoSource}"] [data-testid="call-tile-select"]`
          )
          ?.click();
      await Array.from({ length: switchCount }).reduce<Promise<void>>(
        async (previousSwitch, unused, index) => {
          await previousSwitch;
          clickTile(userIds[index % userIds.length]);
          await new Promise((resolve) => {
            setTimeout(resolve, 0);
          });
        },
        Promise.resolve()
      );
    },
    {
      userIds: [alice.user.userId, carol.user.userId],
      switchCount: RAPID_SWITCH_COUNT,
      videoSource: Track.Source.Camera,
    }
  );

  await expectScreenshareAudioFromOnly(viewer, [carol]);
  await stopWatching(viewer);
  await expectScreenshareAudioFromOnly(viewer, []);
});

test('a watched stream muted locally is not streamed until unmuted', async ({ callSession }) => {
  const { viewer, alice } = await joinCallWithTwoSharers(callSession);
  const toggleAliceScreenshareMute = async () => {
    await getCallTile(viewer.page, alice.user.userId).click({ button: 'right' });
    await viewer.page.getByTestId('call-user-screenshare-mute-toggle').click();
    await viewer.page.keyboard.press('Escape');
  };

  await watchScreenshare(viewer, alice);
  await expectScreenshareAudioFromOnly(viewer, [alice]);

  await toggleAliceScreenshareMute();
  await expectScreenshareAudioFlow(viewer, {
    watchedUserIds: [alice.user.userId],
    unwatchedReceivingCount: 0,
    watchedNotReceivingCount: 1,
  });

  await toggleAliceScreenshareMute();
  await expectScreenshareAudioFromOnly(viewer, [alice]);
});

test('screenshare audio still follows the watched stream after the signal connection resumes', async ({
  callSession,
}) => {
  const signalConnections: WebSocketRoute[] = [];
  const { viewer, alice, carol } = await joinCallWithTwoSharers(callSession, async (client) => {
    await client.page.routeWebSocket(
      (url) => url.href.startsWith(`${LIVEKIT_URL}/rtc`),
      (signalConnection) => {
        signalConnections.push(signalConnection);
        signalConnection.connectToServer();
      }
    );
    await client.page.reload();
    await expect(
      getVoiceRoomEntry(client.page, callSession.homeserver.voiceRoomIds[0])
    ).toBeVisible({ timeout: MEDIA_FLOW_TIMEOUT_MS });
  });
  await watchScreenshare(viewer, alice);
  await expectScreenshareAudioFromOnly(viewer, [alice]);
  const peerConnectionCountBeforeDrop = await readPeerConnectionCount(viewer.page);
  const signalConnectionCountBeforeDrop = signalConnections.length;

  await Promise.all(signalConnections.map((signalConnection) => signalConnection.close()));
  await expect
    .poll(() => signalConnections.length, { timeout: MEDIA_FLOW_TIMEOUT_MS })
    .toBeGreaterThan(signalConnectionCountBeforeDrop);

  await expectScreenshareAudioFromOnly(viewer, [alice]);
  expect(await readPeerConnectionCount(viewer.page)).toBe(peerConnectionCountBeforeDrop);
  await clickSharerTile(viewer, carol);
  await expectScreenshareAudioFromOnly(viewer, [carol]);
  await stopWatching(viewer);
  await expectScreenshareAudioFromOnly(viewer, []);
});
