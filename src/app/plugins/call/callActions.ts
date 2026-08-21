import type { MatrixClient, Room } from 'matrix-js-sdk';
import type { LivekitTransportConfig } from 'matrix-js-sdk/lib/matrixrtc';
import type { MediaDevicePreferences } from './localMedia';
import { connectToCall, disconnectFromCall } from './CallConnection';
import type { CallState } from '../../state/call';

type CallStateSetter = (state: CallState) => void;

export const startCall = async (
  matrixClient: MatrixClient,
  room: Room,
  livekitFoci: LivekitTransportConfig[],
  devicePreferences: MediaDevicePreferences,
  getCallState: () => CallState,
  setCallState: CallStateSetter
): Promise<void> => {
  const callState = getCallState();
  if (callState.status === 'connecting') return;
  if (callState.status === 'connected' || callState.status === 'reconnecting') {
    if (callState.roomId === room.roomId) return;
    try {
      await disconnectFromCall(callState.connection);
    } catch (error) {
      console.error('startCall: failed to leave previous call', error);
    }
  }

  setCallState({ status: 'connecting', roomId: room.roomId });
  try {
    const connection = await connectToCall(matrixClient, room, livekitFoci, devicePreferences);
    setCallState({ status: 'connected', roomId: room.roomId, connection });
  } catch (error) {
    setCallState({
      status: 'failed',
      roomId: room.roomId,
      error: error instanceof Error ? error : new Error(String(error)),
    });
  }
};

export const endCall = async (
  getCallState: () => CallState,
  setCallState: CallStateSetter
): Promise<void> => {
  const callState = getCallState();
  if (callState.status === 'failed') {
    setCallState({ status: 'idle' });
    return;
  }
  if (callState.status !== 'connected' && callState.status !== 'reconnecting') return;
  setCallState({ status: 'idle' });
  try {
    await disconnectFromCall(callState.connection);
  } catch (error) {
    console.error('endCall: failed to leave call', error);
  }
};
