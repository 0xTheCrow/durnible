import { useCallback, useEffect } from 'react';
import { useAtom } from 'jotai';
import type { Room } from 'matrix-js-sdk';
import { RoomEvent } from 'livekit-client';
import { useMatrixClient } from '../useMatrixClient';
import { useLivekitFoci } from '../useLivekitFoci';
import { useSetting } from '../../state/hooks/settings';
import { settingsAtom } from '../../state/settings';
import { callStateAtom } from '../../state/call';
import type { CallState } from '../../state/call';
import {
  connectToCall,
  disconnectFromCall,
  LEAVE_MEMBERSHIP_TIMEOUT_MS,
} from '../../plugins/call/CallConnection';

export const useCallLifecycle = (): {
  callState: CallState;
  startCall: (room: Room) => Promise<void>;
  endCall: () => Promise<void>;
} => {
  const mx = useMatrixClient();
  const [callState, setCallState] = useAtom(callStateAtom);
  const livekitFoci = useLivekitFoci();
  const [preferredAudioInputDeviceId] = useSetting(settingsAtom, 'preferredAudioInputDeviceId');
  const [preferredVideoInputDeviceId] = useSetting(settingsAtom, 'preferredVideoInputDeviceId');
  const [preferredAudioOutputDeviceId] = useSetting(settingsAtom, 'preferredAudioOutputDeviceId');

  const connection =
    callState.status === 'connected' || callState.status === 'reconnecting'
      ? callState.connection
      : undefined;

  useEffect(() => {
    if (!connection) return undefined;
    const { livekitRoom, rtcSession, keyProvider, matrixRoom } = connection;

    const handleReconnecting = () => {
      setCallState({ status: 'reconnecting', roomId: matrixRoom.roomId, connection });
    };
    const handleReconnected = () => {
      setCallState({ status: 'connected', roomId: matrixRoom.roomId, connection });
    };
    const handleDisconnected = () => {
      keyProvider?.clearRtcSession();
      if (rtcSession.isJoined()) {
        rtcSession
          .leaveRoomSession(LEAVE_MEMBERSHIP_TIMEOUT_MS)
          .catch((error) => console.error('useCallLifecycle: failed to leave rtc session', error));
      }
      setCallState({ status: 'idle' });
    };

    livekitRoom.on(RoomEvent.Reconnecting, handleReconnecting);
    livekitRoom.on(RoomEvent.Reconnected, handleReconnected);
    livekitRoom.on(RoomEvent.Disconnected, handleDisconnected);
    return () => {
      livekitRoom.off(RoomEvent.Reconnecting, handleReconnecting);
      livekitRoom.off(RoomEvent.Reconnected, handleReconnected);
      livekitRoom.off(RoomEvent.Disconnected, handleDisconnected);
    };
  }, [connection, setCallState]);

  const startCall = useCallback(
    async (room: Room) => {
      if (callState.status === 'connecting') return;
      if (callState.status === 'connected' || callState.status === 'reconnecting') {
        if (callState.roomId === room.roomId) return;
        try {
          await disconnectFromCall(callState.connection);
        } catch (error) {
          console.error('useCallLifecycle: failed to leave previous call', error);
        }
      }

      setCallState({ status: 'connecting', roomId: room.roomId });
      try {
        const newConnection = await connectToCall(mx, room, livekitFoci, {
          audioInputDeviceId: preferredAudioInputDeviceId,
          videoInputDeviceId: preferredVideoInputDeviceId,
          audioOutputDeviceId: preferredAudioOutputDeviceId,
        });
        setCallState({ status: 'connected', roomId: room.roomId, connection: newConnection });
      } catch (error) {
        setCallState({
          status: 'failed',
          roomId: room.roomId,
          error: error instanceof Error ? error : new Error(String(error)),
        });
      }
    },
    [
      mx,
      callState,
      setCallState,
      livekitFoci,
      preferredAudioInputDeviceId,
      preferredVideoInputDeviceId,
      preferredAudioOutputDeviceId,
    ]
  );

  const endCall = useCallback(async () => {
    if (callState.status === 'failed') {
      setCallState({ status: 'idle' });
      return;
    }
    if (callState.status !== 'connected' && callState.status !== 'reconnecting') return;
    setCallState({ status: 'idle' });
    try {
      await disconnectFromCall(callState.connection);
    } catch (error) {
      console.error('useCallLifecycle: failed to leave call', error);
    }
  }, [callState, setCallState]);

  return { callState, startCall, endCall };
};
