import { useEffect, useState } from 'react';
import type { Participant, Room as LivekitRoom } from 'livekit-client';
import { RoomEvent, Track } from 'livekit-client';
import { getLivekitParticipants } from './useLivekitParticipants';

export type CallVideoSourceKind = Track.Source.Camera | Track.Source.ScreenShare;

export type CallVideoSource = {
  key: string;
  participant: Participant;
  source: CallVideoSourceKind;
};

const makeVideoSourceKey = (participant: Participant, source: CallVideoSourceKind): string =>
  `${participant.identity}:${source}`;

const getCallVideoSources = (livekitRoom: LivekitRoom): CallVideoSource[] =>
  getLivekitParticipants(livekitRoom).flatMap((participant) => {
    const sources: CallVideoSource[] = [
      {
        key: makeVideoSourceKey(participant, Track.Source.Camera),
        participant,
        source: Track.Source.Camera,
      },
    ];
    const screensharePublication = participant.getTrackPublication(Track.Source.ScreenShare);
    if (screensharePublication && !screensharePublication.isMuted) {
      sources.push({
        key: makeVideoSourceKey(participant, Track.Source.ScreenShare),
        participant,
        source: Track.Source.ScreenShare,
      });
    }
    return sources;
  });

const VIDEO_SOURCE_EVENTS = [
  RoomEvent.ParticipantConnected,
  RoomEvent.ParticipantDisconnected,
  RoomEvent.TrackPublished,
  RoomEvent.TrackUnpublished,
  RoomEvent.TrackMuted,
  RoomEvent.TrackUnmuted,
  RoomEvent.LocalTrackPublished,
  RoomEvent.LocalTrackUnpublished,
] as const;

export const useCallVideoSources = (livekitRoom: LivekitRoom): CallVideoSource[] => {
  const [videoSources, setVideoSources] = useState(() => getCallVideoSources(livekitRoom));
  const [prev, setPrev] = useState(livekitRoom);
  if (prev !== livekitRoom) {
    setPrev(livekitRoom);
    setVideoSources(getCallVideoSources(livekitRoom));
  }

  useEffect(() => {
    const handleVideoSourcesChanged = () => {
      setVideoSources(getCallVideoSources(livekitRoom));
    };
    VIDEO_SOURCE_EVENTS.forEach((event) => livekitRoom.on(event, handleVideoSourcesChanged));
    return () => {
      VIDEO_SOURCE_EVENTS.forEach((event) => livekitRoom.off(event, handleVideoSourcesChanged));
    };
  }, [livekitRoom]);

  return videoSources;
};
