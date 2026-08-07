import { useEffect, useState } from 'react';
import type { Participant, Room as LivekitRoom } from 'livekit-client';
import { RoomEvent, Track } from 'livekit-client';
import { getLivekitParticipants } from './useLivekitParticipants';

export type CallVideoSourceKind = Track.Source.Camera | Track.Source.ScreenShare;

export type CallParticipantEntry = {
  key: string;
  participant: Participant;
  isScreensharing: boolean;
  isMicrophoneMuted: boolean;
};

const getCallParticipantEntries = (livekitRoom?: LivekitRoom): CallParticipantEntry[] => {
  if (!livekitRoom) return [];
  return getLivekitParticipants(livekitRoom).map((participant) => {
    const screensharePublication = participant.getTrackPublication(Track.Source.ScreenShare);
    const microphonePublication = participant.getTrackPublication(Track.Source.Microphone);
    return {
      key: participant.identity,
      participant,
      isScreensharing: screensharePublication !== undefined && !screensharePublication.isMuted,
      isMicrophoneMuted: microphonePublication === undefined || microphonePublication.isMuted,
    };
  });
};

const PARTICIPANT_ENTRY_EVENTS = [
  RoomEvent.ParticipantConnected,
  RoomEvent.ParticipantDisconnected,
  RoomEvent.TrackPublished,
  RoomEvent.TrackUnpublished,
  RoomEvent.TrackMuted,
  RoomEvent.TrackUnmuted,
  RoomEvent.LocalTrackPublished,
  RoomEvent.LocalTrackUnpublished,
] as const;

export const useCallParticipantEntries = (livekitRoom?: LivekitRoom): CallParticipantEntry[] => {
  const [entries, setEntries] = useState(() => getCallParticipantEntries(livekitRoom));
  const [prev, setPrev] = useState(livekitRoom);
  if (prev !== livekitRoom) {
    setPrev(livekitRoom);
    setEntries(getCallParticipantEntries(livekitRoom));
  }

  useEffect(() => {
    if (!livekitRoom) return undefined;
    const handleEntriesChanged = () => {
      setEntries(getCallParticipantEntries(livekitRoom));
    };
    PARTICIPANT_ENTRY_EVENTS.forEach((event) => livekitRoom.on(event, handleEntriesChanged));
    return () => {
      PARTICIPANT_ENTRY_EVENTS.forEach((event) => livekitRoom.off(event, handleEntriesChanged));
    };
  }, [livekitRoom]);

  return entries;
};
