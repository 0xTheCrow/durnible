import { useAtomValue } from 'jotai';
import type { Room } from 'matrix-js-sdk';
import { callStateAtom, isCallDeafenedAtom } from '../../state/call';
import { findCallParticipantUserId } from '../../utils/call';
import { useCallMemberships } from '../useCallMemberships';
import { useCallParticipantEntries } from './useCallParticipantEntries';

export type CallParticipantAudioState = 'active' | 'muted' | 'deafened';

export const useCallParticipantAudioStates = (
  room: Room
): Map<string, CallParticipantAudioState> => {
  const callState = useAtomValue(callStateAtom);
  const isDeafened = useAtomValue(isCallDeafenedAtom);
  const memberships = useCallMemberships(room);

  const connection =
    (callState.status === 'connected' || callState.status === 'reconnecting') &&
    callState.roomId === room.roomId
      ? callState.connection
      : undefined;
  const entries = useCallParticipantEntries(connection?.livekitRoom);

  const audioStates = new Map<string, CallParticipantAudioState>();
  entries.forEach((entry) => {
    const userId = findCallParticipantUserId(entry.participant.identity, memberships);
    if (!userId) return;
    if (entry.participant.isLocal && isDeafened) {
      audioStates.set(userId, 'deafened');
      return;
    }
    audioStates.set(userId, entry.isMicrophoneMuted ? 'muted' : 'active');
  });

  return audioStates;
};
