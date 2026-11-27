import { useEffect } from 'react';
import { useSetAtom } from 'jotai';
import type { Room as LivekitRoom } from 'livekit-client';
import { Track } from 'livekit-client';
import {
  activeCallParticipantSnapshotsAtom,
  type ActiveCallParticipantSnapshot,
} from '../../state/call';
import { getLivekitParticipants } from './useLivekitParticipants';
import {
  PARTICIPANT_SNAPSHOT_EVENTS,
  checkIsScreenshareAudioEnabled,
} from './useCallParticipantSnapshots';

const getActiveCallParticipantSnapshots = (
  livekitRoom: LivekitRoom
): ActiveCallParticipantSnapshot[] =>
  getLivekitParticipants(livekitRoom).map((participant) => {
    const microphonePublication = participant.getTrackPublication(Track.Source.Microphone);
    return {
      identity: participant.identity,
      isLocal: participant.isLocal,
      isMicrophoneMuted: microphonePublication === undefined || microphonePublication.isMuted,
      isScreenshareAudioEnabled: checkIsScreenshareAudioEnabled(participant),
    };
  });

export const useActiveCallParticipantSnapshotsStore = (livekitRoom: LivekitRoom | undefined) => {
  const setActiveCallParticipantSnapshots = useSetAtom(activeCallParticipantSnapshotsAtom);

  useEffect(() => {
    if (!livekitRoom) {
      setActiveCallParticipantSnapshots([]);
      return undefined;
    }
    const handleActiveCallParticipantSnapshotsChanged = () => {
      setActiveCallParticipantSnapshots(getActiveCallParticipantSnapshots(livekitRoom));
    };
    handleActiveCallParticipantSnapshotsChanged();
    PARTICIPANT_SNAPSHOT_EVENTS.forEach((event) =>
      livekitRoom.on(event, handleActiveCallParticipantSnapshotsChanged)
    );
    return () => {
      PARTICIPANT_SNAPSHOT_EVENTS.forEach((event) =>
        livekitRoom.off(event, handleActiveCallParticipantSnapshotsChanged)
      );
    };
  }, [livekitRoom, setActiveCallParticipantSnapshots]);
};
