import type { Browser, BrowserContext, Locator, Page, ViewportSize } from '@playwright/test';
import { expect, test } from '@playwright/test';
import { Track } from 'livekit-client';
import type { Settings } from '../../src/app/state/settings';
import type { CallHomeserver, CallTestUser } from './callHomeserver';
import { CALL_TEST_USERS, createCallHomeserver } from './callHomeserver';
import { seedSession, seedSettings } from './homeserver';

export const MEDIA_FLOW_TIMEOUT_MS = 20_000;
const CLIENT_BOOT_TIMEOUT_MS = 20_000;

type MediaProbe = {
  peerConnections: RTCPeerConnection[];
  displayCaptureTrackIds: Set<string>;
};

declare global {
  interface Window {
    durnibleE2eMediaProbe?: MediaProbe;
  }
}

/**
 * Records every RTCPeerConnection the page creates and the ids of tracks returned by
 * getDisplayMedia. Both wrappers pass calls through unchanged; they only let the specs find
 * the WebRTC senders and receivers behind what the app renders.
 */
const installMediaProbe = (context: BrowserContext): Promise<void> =>
  context.addInitScript(() => {
    const probe: MediaProbe = { peerConnections: [], displayCaptureTrackIds: new Set() };
    window.durnibleE2eMediaProbe = probe;

    const NativePeerConnection = window.RTCPeerConnection;
    window.RTCPeerConnection = class extends NativePeerConnection {
      constructor(configuration?: RTCConfiguration) {
        super(configuration);
        probe.peerConnections.push(this);
      }
    };

    const nativeGetDisplayMedia = navigator.mediaDevices.getDisplayMedia.bind(
      navigator.mediaDevices
    );
    navigator.mediaDevices.getDisplayMedia = async (options) => {
      const stream = await nativeGetDisplayMedia(options);
      stream.getTracks().forEach((track) => probe.displayCaptureTrackIds.add(track.id));
      return stream;
    };
  });

export const getVoiceRoomEntry = (page: Page, roomId: string): Locator =>
  page.locator(`[data-testid="voice-room-entry"][data-room-id="${roomId}"]`);

export type CallClient = {
  user: CallTestUser;
  context: BrowserContext;
  page: Page;
};

type OpenCallClientOptions = {
  settings?: Partial<Settings>;
  viewport?: ViewportSize;
};

const openCallClient = async (
  browser: Browser,
  homeserver: CallHomeserver,
  user: CallTestUser,
  { settings, viewport }: OpenCallClientOptions = {}
): Promise<CallClient> => {
  const context = await browser.newContext({
    permissions: ['microphone', 'camera'],
    serviceWorkers: 'block',
    viewport,
  });
  await seedSession(context, user);
  await installMediaProbe(context);
  const page = await context.newPage();
  if (settings) await seedSettings(page, settings);
  await homeserver.attach(page, user);
  await page.goto(`/${encodeURIComponent(homeserver.spaceId)}/`);
  await expect(getVoiceRoomEntry(page, homeserver.voiceRoomIds[0])).toBeVisible({
    timeout: CLIENT_BOOT_TIMEOUT_MS,
  });
  return { user, context, page };
};

export const joinVoiceRoom = async (page: Page, roomId: string): Promise<void> => {
  const voiceRoomEntry = getVoiceRoomEntry(page, roomId);
  await voiceRoomEntry.click();
  await expect(voiceRoomEntry).toHaveAttribute('data-call-entry-status', 'connected', {
    timeout: MEDIA_FLOW_TIMEOUT_MS,
  });
};

export const getCallTile = (
  page: Page,
  userId: string,
  videoSource: Track.Source = Track.Source.Camera
): Locator =>
  page.locator(
    `[data-testid="call-tile"][data-user-id="${userId}"][data-video-source="${videoSource}"]`
  );

export const getVoiceRoomParticipant = (page: Page, userId: string): Locator =>
  page.locator(`[data-testid="voice-room-participant"][data-user-id="${userId}"]`);

export const getParticipantAudio = (
  page: Page,
  userId: string,
  trackSource: Track.Source
): Locator =>
  page.locator(
    `[data-testid="call-participant-audio"][data-user-id="${userId}"][data-track-source="${trackSource}"]`
  );

type LocalTrackOrigin = 'displayCapture' | 'other';

type LocalSenderQuery = {
  kind: 'audio' | 'video';
  origin: LocalTrackOrigin;
};

export type LocalSenderSnapshot = {
  trackId: string;
  bytesSent: number;
  encodings: RTCRtpEncodingParameters[];
  trackSettings: MediaTrackSettings;
};

/**
 * Reads the first live sender carrying a local track of the given kind and origin, across
 * every peer connection the page opened. Resolves to undefined when there is none.
 */
export const readLocalSender = (
  page: Page,
  query: LocalSenderQuery
): Promise<LocalSenderSnapshot | undefined> =>
  page.evaluate(async ({ kind, origin }) => {
    const probe = window.durnibleE2eMediaProbe;
    if (!probe) throw new Error('media probe not installed');
    const senders = probe.peerConnections
      .filter((peerConnection) => peerConnection.connectionState !== 'closed')
      .flatMap((peerConnection) => peerConnection.getSenders());
    const sender = senders.find((candidate) => {
      const { track } = candidate;
      if (!track || track.kind !== kind || track.readyState !== 'live') return false;
      const isDisplayCapture = probe.displayCaptureTrackIds.has(track.id);
      return origin === 'displayCapture' ? isDisplayCapture : !isDisplayCapture;
    });
    if (!sender?.track) return undefined;

    let bytesSent = 0;
    (await sender.getStats()).forEach((report) => {
      if (report.type === 'outbound-rtp') bytesSent += report.bytesSent ?? 0;
    });
    return {
      trackId: sender.track.id,
      bytesSent,
      encodings: sender.getParameters().encodings,
      trackSettings: sender.track.getSettings(),
    };
  }, query);

/**
 * Bytes received for the track playing in the given media element, read from the
 * RTCRtpReceiver that delivers it. Resolves to 0 while the element has no track.
 */
export const readReceivedBytes = (mediaElement: Locator): Promise<number> =>
  mediaElement.evaluate(async (element) => {
    const probe = window.durnibleE2eMediaProbe;
    if (!probe) throw new Error('media probe not installed');
    const { srcObject } = element as HTMLMediaElement;
    const track = srcObject instanceof MediaStream ? srcObject.getTracks()[0] : undefined;
    if (!track) return 0;
    const receiver = probe.peerConnections
      .flatMap((peerConnection) => peerConnection.getReceivers())
      .find((candidate) => candidate.track.id === track.id);
    if (!receiver) return 0;
    let bytesReceived = 0;
    (await receiver.getStats()).forEach((report) => {
      if (report.type === 'inbound-rtp') bytesReceived += report.bytesReceived ?? 0;
    });
    return bytesReceived;
  });

export const readDecodedFrameCount = (videoElement: Locator): Promise<number> =>
  videoElement.evaluate(
    (element) => (element as HTMLVideoElement).getVideoPlaybackQuality().totalVideoFrames
  );

export const readOpenPeerConnectionCount = (page: Page): Promise<number> =>
  page.evaluate(() => {
    const probe = window.durnibleE2eMediaProbe;
    if (!probe) throw new Error('media probe not installed');
    return probe.peerConnections.filter(
      (peerConnection) => peerConnection.connectionState !== 'closed'
    ).length;
  });

/**
 * Passes once the value read by `readValue` has grown past what it was on the first read,
 * proving the media behind it is still flowing rather than having flowed once.
 */
export const expectToKeepGrowing = async (readValue: () => Promise<number>): Promise<void> => {
  const initialValue = await readValue();
  await expect.poll(readValue, { timeout: MEDIA_FLOW_TIMEOUT_MS }).toBeGreaterThan(initialValue);
};

export const pressRepeatedly = (locator: Locator, key: string, count: number): Promise<void> =>
  Array.from({ length: count }).reduce<Promise<void>>(
    (previousPress) => previousPress.then(() => locator.press(key)),
    Promise.resolve()
  );

export type CallSession = {
  homeserver: CallHomeserver;
  openClient: (user: CallTestUser, options?: OpenCallClientOptions) => Promise<CallClient>;
};

type ConnectedPair = { alice: CallClient; bob: CallClient; voiceRoomId: string };

export const connectBobThenAlice = async (callSession: CallSession): Promise<ConnectedPair> => {
  const [voiceRoomId] = callSession.homeserver.voiceRoomIds;
  const bob = await callSession.openClient(CALL_TEST_USERS.bob);
  const alice = await callSession.openClient(CALL_TEST_USERS.alice);
  await joinVoiceRoom(bob.page, voiceRoomId);
  await joinVoiceRoom(alice.page, voiceRoomId);
  await expect(getCallTile(bob.page, alice.user.userId)).toBeVisible({
    timeout: MEDIA_FLOW_TIMEOUT_MS,
  });
  await expect(getCallTile(alice.page, bob.user.userId)).toBeVisible({
    timeout: MEDIA_FLOW_TIMEOUT_MS,
  });
  return { alice, bob, voiceRoomId };
};

export const callTest = test.extend<{ callSession: CallSession }>({
  callSession: async ({ browser }, use) => {
    const homeserver = createCallHomeserver();
    const clients: CallClient[] = [];
    await use({
      homeserver,
      openClient: async (user, options) => {
        const client = await openCallClient(browser, homeserver, user, options);
        clients.push(client);
        return client;
      },
    });
    await Promise.all(clients.map((client) => client.context.close()));
  },
});
