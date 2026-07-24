import { useCallback } from 'react';
import { useAtomValue } from 'jotai';
import type { Room } from 'matrix-js-sdk';
import { callStateAtom } from '../../state/call';
import { useCallActions } from './CallProvider';

export type VoiceRoomEntryState =
  | { status: 'idle' }
  | { status: 'connecting' }
  | { status: 'connected' }
  | { status: 'failed'; error: Error };

export const useVoiceRoomEntry = (
  room: Room
): { entryState: VoiceRoomEntryState; enterVoiceRoom: () => Promise<void> } => {
  const callState = useAtomValue(callStateAtom);
  const { startCall } = useCallActions();

  let entryState: VoiceRoomEntryState = { status: 'idle' };
  if (callState.status !== 'idle' && callState.roomId === room.roomId) {
    if (callState.status === 'connecting') entryState = { status: 'connecting' };
    else if (callState.status === 'failed')
      entryState = { status: 'failed', error: callState.error };
    else entryState = { status: 'connected' };
  }

  const enterVoiceRoom = useCallback(() => startCall(room), [startCall, room]);

  return { entryState, enterVoiceRoom };
};
