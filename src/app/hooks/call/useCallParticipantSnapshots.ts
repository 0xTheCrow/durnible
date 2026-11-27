import { useEffect, useState } from 'react';
import type { Participant, Room as LivekitRoom } from 'livekit-client';
import { RoomEvent, Track } from 'livekit-client';
import { getLivekitParticipants } from './useLivekitParticipants';

export type CallVideoSourceKind = Track.Source.Camera | Track.Source.ScreenShare;

export type CallParticipantSnapshot = {
  key: string;
  participant: Participant;
  isScreensharing: boolean;
  isScreenshareAudioEnabled: boolean;
  isCameraEnabled: boolean;
  isMicrophoneMuted: boolean;
};

export const checkIsParticipantSnapshotStreamingVideo = (
  participantSnapshot: CallParticipantSnapshot
): boolean => participantSnapshot.isScreensharing || participantSnapshot.isCameraEnabled;

export const checkIsScreenshareAudioEnabled = (participant: Participant): boolean => {
  const publication = participant.getTrackPublication(Track.Source.ScreenShareAudio);
  return publication !== undefined && !publication.isMuted;
};

const getCallParticipantSnapshots = (livekitRoom?: LivekitRoom): CallParticipantSnapshot[] => {
  if (!livekitRoom) return [];
  return getLivekitParticipants(livekitRoom).map((participant) => {
    const screensharePublication = participant.getTrackPublication(Track.Source.ScreenShare);
    const cameraPublication = participant.getTrackPublication(Track.Source.Camera);
    const microphonePublication = participant.getTrackPublication(Track.Source.Microphone);
    return {
      key: participant.identity,
      participant,
      isScreensharing: screensharePublication !== undefined && !screensharePublication.isMuted,
      isScreenshareAudioEnabled: checkIsScreenshareAudioEnabled(participant),
      isCameraEnabled: cameraPublication !== undefined && !cameraPublication.isMuted,
      isMicrophoneMuted: microphonePublication === undefined || microphonePublication.isMuted,
    };
  });
};

export const PARTICIPANT_SNAPSHOT_EVENTS = [
  RoomEvent.ParticipantConnected,
  RoomEvent.ParticipantDisconnected,
  RoomEvent.TrackPublished,
  RoomEvent.TrackUnpublished,
  RoomEvent.TrackMuted,
  RoomEvent.TrackUnmuted,
  RoomEvent.LocalTrackPublished,
  RoomEvent.LocalTrackUnpublished,
] as const;

export const useCallParticipantSnapshots = (
  livekitRoom?: LivekitRoom
): CallParticipantSnapshot[] => {
  const [participantSnapshots, setParticipantSnapshots] = useState(() =>
    getCallParticipantSnapshots(livekitRoom)
  );
  const [prev, setPrev] = useState(livekitRoom);
  if (prev !== livekitRoom) {
    setPrev(livekitRoom);
    setParticipantSnapshots(getCallParticipantSnapshots(livekitRoom));
  }

  useEffect(() => {
    if (!livekitRoom) return undefined;
    const handleParticipantSnapshotsChanged = () => {
      setParticipantSnapshots(getCallParticipantSnapshots(livekitRoom));
    };
    PARTICIPANT_SNAPSHOT_EVENTS.forEach((event) =>
      livekitRoom.on(event, handleParticipantSnapshotsChanged)
    );
    return () => {
      PARTICIPANT_SNAPSHOT_EVENTS.forEach((event) =>
        livekitRoom.off(event, handleParticipantSnapshotsChanged)
      );
    };
  }, [livekitRoom]);

  return participantSnapshots;
};
