import { useAtomValue } from 'jotai';
import type { Room } from 'matrix-js-sdk';
import { callStateAtom, isCallDeafenedAtom } from '../../state/call';
import { findCallParticipantUserId } from '../../utils/call';
import { useCallMemberships } from '../useCallMemberships';
import { useCallParticipantEntries } from './useCallParticipantEntries';

export type CallParticipantAudioState = 'active' | 'muted' | 'deafened';

export type CallParticipantState = {
  audioState: CallParticipantAudioState;
  isScreenshareAudioEnabled: boolean;
};

export const useCallParticipantStates = (room: Room): Map<string, CallParticipantState> => {
  const callState = useAtomValue(callStateAtom);
  const isDeafened = useAtomValue(isCallDeafenedAtom);
  const memberships = useCallMemberships(room);

  const connection =
    (callState.status === 'connected' || callState.status === 'reconnecting') &&
    callState.roomId === room.roomId
      ? callState.connection
      : undefined;
  const entries = useCallParticipantEntries(connection?.livekitRoom);

  const participantStates = new Map<string, CallParticipantState>();
  entries.forEach((entry) => {
    const userId = findCallParticipantUserId(entry.participant.identity, memberships);
    if (!userId) return;

    const getAudioState = (): CallParticipantAudioState => {
      if (entry.participant.isLocal && isDeafened) return 'deafened';
      return entry.isMicrophoneMuted ? 'muted' : 'active';
    };

    participantStates.set(userId, {
      audioState: getAudioState(),
      isScreenshareAudioEnabled: entry.isScreenshareAudioEnabled,
    });
  });

  return participantStates;
};
