import React, { useEffect } from 'react';
import { useAtom } from 'jotai';
import type { Participant } from 'livekit-client';
import { DisconnectReason, RoomEvent } from 'livekit-client';
import { callStateAtom } from '../../state/call';
import type { CallState } from '../../state/call';
import { LEAVE_MEMBERSHIP_TIMEOUT_MS } from '../../plugins/call/CallConnection';
import { useActiveCallParticipantEntriesStore } from '../../hooks/call/useActiveCallParticipantEntriesStore';
import { CallAudioRenderer } from './CallAudioRenderer';
import { CallMicrophoneGate } from './CallMicrophoneGate';

export function CallEngineMount() {
  const [callState, setCallState] = useAtom(callStateAtom);
  const connection =
    callState.status === 'connected' || callState.status === 'reconnecting'
      ? callState.connection
      : undefined;

  useActiveCallParticipantEntriesStore(connection?.livekitRoom);

  useEffect(() => {
    if (!connection) return undefined;
    const { livekitRoom, rtcSession, keyProvider } = connection;

    const handleReconnecting = () => {
      setCallState({ status: 'reconnecting', roomId: connection.matrixRoom.roomId, connection });
    };
    const handleReconnected = () => {
      setCallState({ status: 'connected', roomId: connection.matrixRoom.roomId, connection });
    };
    const handleDisconnected = (reason?: DisconnectReason) => {
      keyProvider?.clearRtcSession();
      if (reason !== DisconnectReason.CLIENT_INITIATED && rtcSession.isJoined()) {
        rtcSession
          .leaveRoomSession(LEAVE_MEMBERSHIP_TIMEOUT_MS)
          .catch((error) => console.error('CallEngineMount: failed to leave rtc session', error));
      }
      setCallState({ status: 'idle' });
    };
    const handleEncryptionError = (error: Error, participant?: Participant) => {
      console.error('CallEngineMount: call media encryption error', {
        error,
        participantIdentity: participant?.identity,
        isRoomE2EEEnabled: livekitRoom.isE2EEEnabled,
      });
    };

    livekitRoom.on(RoomEvent.Reconnecting, handleReconnecting);
    livekitRoom.on(RoomEvent.Reconnected, handleReconnected);
    livekitRoom.on(RoomEvent.Disconnected, handleDisconnected);
    livekitRoom.on(RoomEvent.EncryptionError, handleEncryptionError);
    return () => {
      livekitRoom.off(RoomEvent.Reconnecting, handleReconnecting);
      livekitRoom.off(RoomEvent.Reconnected, handleReconnected);
      livekitRoom.off(RoomEvent.Disconnected, handleDisconnected);
      livekitRoom.off(RoomEvent.EncryptionError, handleEncryptionError);
    };
  }, [connection, setCallState]);

  return (
    <>
      <CallAudioRenderer />
      <CallMicrophoneGate />
    </>
  );
}

export type { CallState };
