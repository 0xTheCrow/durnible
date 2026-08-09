import { Room as LivekitRoom, ScreenSharePresets } from 'livekit-client';
import type { MatrixClient, Room } from 'matrix-js-sdk';
import type { LivekitTransportConfig, MatrixRTCSession } from 'matrix-js-sdk/lib/matrixrtc';
import { isLivekitTransportConfig } from 'matrix-js-sdk/lib/matrixrtc';
import LivekitE2EEWorker from 'livekit-client/e2ee-worker?worker';
import { MatrixKeyProvider } from './MatrixKeyProvider';
import { getSfuConnectionDetails } from './sfu';
import type { MediaDevicePreferences } from './localMedia';

export const LEAVE_MEMBERSHIP_TIMEOUT_MS = 10_000;

export type CallConnection = {
  matrixClient: MatrixClient;
  matrixRoom: Room;
  rtcSession: MatrixRTCSession;
  livekitRoom: LivekitRoom;
  keyProvider?: MatrixKeyProvider;
};

export const getActiveLivekitServiceUrl = (
  rtcSession: MatrixRTCSession,
  preferredFoci: LivekitTransportConfig[]
): string | undefined => {
  const oldestMembership = rtcSession.getOldestMembership();
  const activeTransport = oldestMembership?.getTransport(oldestMembership);
  if (activeTransport && isLivekitTransportConfig(activeTransport)) {
    return activeTransport.livekit_service_url;
  }
  return preferredFoci[0]?.livekit_service_url;
};

export const connectToCall = async (
  matrixClient: MatrixClient,
  matrixRoom: Room,
  preferredFoci: LivekitTransportConfig[],
  devicePreferences: MediaDevicePreferences = {}
): Promise<CallConnection> => {
  const userId = matrixClient.getUserId();
  const deviceId = matrixClient.getDeviceId();
  if (!userId || !deviceId) throw new Error('Matrix client has no user id or device id');

  const rtcSession = matrixClient.matrixRTC.getRoomSession(matrixRoom);
  const keyProvider = matrixRoom.hasEncryptionStateEvent() ? new MatrixKeyProvider() : undefined;
  const livekitRoom = new LivekitRoom({
    adaptiveStream: true,
    dynacast: true,
    audioCaptureDefaults: { deviceId: devicePreferences.audioInputDeviceId },
    videoCaptureDefaults: { deviceId: devicePreferences.videoInputDeviceId },
    publishDefaults: { screenShareEncoding: ScreenSharePresets.h1080fps30.encoding },
    e2ee: keyProvider ? { keyProvider, worker: new LivekitE2EEWorker() } : undefined,
  });

  keyProvider?.setRtcSession(rtcSession);
  rtcSession.joinRTCSession(
    { userId, deviceId, memberId: `${userId}:${deviceId}` },
    preferredFoci,
    undefined,
    { manageMediaKeys: keyProvider !== undefined }
  );

  try {
    await rtcSession.initialMembershipCalculated;
    const livekitServiceUrl = getActiveLivekitServiceUrl(rtcSession, preferredFoci);
    if (!livekitServiceUrl) throw new Error('No LiveKit service url available for this call');

    const { url, jwt } = await getSfuConnectionDetails(
      matrixClient,
      livekitServiceUrl,
      matrixRoom.roomId
    );
    if (keyProvider) await livekitRoom.setE2EEEnabled(true);
    await livekitRoom.connect(url, jwt);
    await livekitRoom.localParticipant.setMicrophoneEnabled(true).catch(() => undefined);
    if (devicePreferences.audioOutputDeviceId) {
      await livekitRoom.switchActiveDevice('audiooutput', devicePreferences.audioOutputDeviceId);
    }
  } catch (error) {
    keyProvider?.clearRtcSession();
    await livekitRoom.disconnect().catch(() => undefined);
    if (rtcSession.isJoined()) await rtcSession.leaveRoomSession(LEAVE_MEMBERSHIP_TIMEOUT_MS);
    throw error;
  }

  return { matrixClient, matrixRoom, rtcSession, livekitRoom, keyProvider };
};

export const disconnectFromCall = async (connection: CallConnection): Promise<void> => {
  await connection.livekitRoom.disconnect();
  connection.keyProvider?.clearRtcSession();
  await connection.rtcSession.leaveRoomSession(LEAVE_MEMBERSHIP_TIMEOUT_MS);
};
