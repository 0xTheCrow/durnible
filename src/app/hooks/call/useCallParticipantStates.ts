import { useAtomValue } from 'jotai';
import type { Room } from 'matrix-js-sdk';
import { activeCallParticipantEntriesAtom, isCallDeafenedAtom } from '../../state/call';
import { findCallParticipantUserId } from '../../utils/call';
import { useCallMemberships } from '../useCallMemberships';

export type CallParticipantAudioState = 'active' | 'muted' | 'deafened';

export type CallParticipantState = {
  audioState: CallParticipantAudioState;
  isScreenshareAudioEnabled: boolean;
};

export const useCallParticipantStates = (room: Room): Map<string, CallParticipantState> => {
  const isDeafened = useAtomValue(isCallDeafenedAtom);
  const memberships = useCallMemberships(room);
  const entries = useAtomValue(activeCallParticipantEntriesAtom);

  const participantStates = new Map<string, CallParticipantState>();
  entries.forEach((entry) => {
    const userId = findCallParticipantUserId(entry.identity, memberships);
    if (!userId) return;

    const getAudioState = (): CallParticipantAudioState => {
      if (entry.isLocal && isDeafened) return 'deafened';
      return entry.isMicrophoneMuted ? 'muted' : 'active';
    };

    participantStates.set(userId, {
      audioState: getAudioState(),
      isScreenshareAudioEnabled: entry.isScreenshareAudioEnabled,
    });
  });

  return participantStates;
};
