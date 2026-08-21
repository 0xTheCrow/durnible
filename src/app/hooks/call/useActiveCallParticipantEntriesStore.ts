import { useEffect } from 'react';
import { useSetAtom } from 'jotai';
import type { Room as LivekitRoom } from 'livekit-client';
import { Track } from 'livekit-client';
import {
  activeCallParticipantEntriesAtom,
  type ActiveCallParticipantEntry,
} from '../../state/call';
import { getLivekitParticipants } from './useLivekitParticipants';
import {
  PARTICIPANT_ENTRY_EVENTS,
  checkIsScreenshareAudioEnabled,
} from './useCallParticipantEntries';

const getActiveCallParticipantEntries = (livekitRoom: LivekitRoom): ActiveCallParticipantEntry[] =>
  getLivekitParticipants(livekitRoom).map((participant) => {
    const microphonePublication = participant.getTrackPublication(Track.Source.Microphone);
    return {
      identity: participant.identity,
      isLocal: participant.isLocal,
      isMicrophoneMuted: microphonePublication === undefined || microphonePublication.isMuted,
      isScreenshareAudioEnabled: checkIsScreenshareAudioEnabled(participant),
    };
  });

export const useActiveCallParticipantEntriesStore = (livekitRoom: LivekitRoom | undefined) => {
  const setEntries = useSetAtom(activeCallParticipantEntriesAtom);

  useEffect(() => {
    if (!livekitRoom) {
      setEntries([]);
      return undefined;
    }
    const handleEntriesChanged = () => {
      setEntries(getActiveCallParticipantEntries(livekitRoom));
    };
    handleEntriesChanged();
    PARTICIPANT_ENTRY_EVENTS.forEach((event) => livekitRoom.on(event, handleEntriesChanged));
    return () => {
      PARTICIPANT_ENTRY_EVENTS.forEach((event) => livekitRoom.off(event, handleEntriesChanged));
    };
  }, [livekitRoom, setEntries]);
};
