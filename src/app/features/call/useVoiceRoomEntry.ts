import { useCallback } from 'react';
import { useAtomValue, useSetAtom } from 'jotai';
import type { Room } from 'matrix-js-sdk';
import { callPreJoinRoomIdAtom, callStateAtom } from '../../state/call';
import { settingsAtom } from '../../state/settings';
import { useSetting } from '../../state/hooks/settings';
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
  const setPreJoinRoomId = useSetAtom(callPreJoinRoomIdAtom);
  const [showCallPreJoinScreen] = useSetting(settingsAtom, 'showCallPreJoinScreen');
  const { startCall } = useCallActions();

  let entryState: VoiceRoomEntryState = { status: 'idle' };
  if (callState.status !== 'idle' && callState.roomId === room.roomId) {
    if (callState.status === 'connecting') entryState = { status: 'connecting' };
    else if (callState.status === 'failed')
      entryState = { status: 'failed', error: callState.error };
    else entryState = { status: 'connected' };
  }

  const isInThisRoomCall = entryState.status === 'connecting' || entryState.status === 'connected';

  const enterVoiceRoom = useCallback(async () => {
    if (showCallPreJoinScreen && !isInThisRoomCall) {
      setPreJoinRoomId(room.roomId);
      return;
    }
    await startCall(room);
  }, [showCallPreJoinScreen, isInThisRoomCall, setPreJoinRoomId, startCall, room]);

  return { entryState, enterVoiceRoom };
};
