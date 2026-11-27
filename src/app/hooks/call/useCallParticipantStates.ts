import { useAtomValue } from 'jotai';
import type { Room } from 'matrix-js-sdk';
import { activeCallParticipantSnapshotsAtom, isCallDeafenedAtom } from '../../state/call';
import { findCallParticipantUserId } from '../../utils/call';
import { useCallMemberships } from './useCallMemberships';

export type CallParticipantAudioState = 'active' | 'muted' | 'deafened';

export type CallParticipantState = {
  audioState: CallParticipantAudioState;
  isScreenshareAudioEnabled: boolean;
};

export const useCallParticipantStates = (room: Room): Map<string, CallParticipantState> => {
  const isDeafened = useAtomValue(isCallDeafenedAtom);
  const memberships = useCallMemberships(room);
  const activeCallParticipantSnapshots = useAtomValue(activeCallParticipantSnapshotsAtom);

  const participantStates = new Map<string, CallParticipantState>();
  activeCallParticipantSnapshots.forEach((participantSnapshot) => {
    const userId = findCallParticipantUserId(participantSnapshot.identity, memberships);
    if (!userId) return;

    const getAudioState = (): CallParticipantAudioState => {
      if (participantSnapshot.isLocal && isDeafened) return 'deafened';
      return participantSnapshot.isMicrophoneMuted ? 'muted' : 'active';
    };

    participantStates.set(userId, {
      audioState: getAudioState(),
      isScreenshareAudioEnabled: participantSnapshot.isScreenshareAudioEnabled,
    });
  });

  return participantStates;
};
