import { useCallback, useEffect, useState } from 'react';
import type { Room as LivekitRoom } from 'livekit-client';
import { ParticipantEvent } from 'livekit-client';

export type LocalMediaState = {
  isMicrophoneEnabled: boolean;
  isCameraEnabled: boolean;
  isScreenshareEnabled: boolean;
};

const getLocalMediaState = (livekitRoom: LivekitRoom): LocalMediaState => ({
  isMicrophoneEnabled: livekitRoom.localParticipant.isMicrophoneEnabled,
  isCameraEnabled: livekitRoom.localParticipant.isCameraEnabled,
  isScreenshareEnabled: livekitRoom.localParticipant.isScreenShareEnabled,
});

const LOCAL_MEDIA_EVENTS = [
  ParticipantEvent.LocalTrackPublished,
  ParticipantEvent.LocalTrackUnpublished,
  ParticipantEvent.TrackMuted,
  ParticipantEvent.TrackUnmuted,
] as const;

export const useLocalMediaControls = (
  livekitRoom: LivekitRoom
): LocalMediaState & {
  toggleMicrophone: () => Promise<void>;
  toggleCamera: () => Promise<void>;
  toggleScreenshare: () => Promise<void>;
} => {
  const [localMediaState, setLocalMediaState] = useState(() => getLocalMediaState(livekitRoom));
  const [prev, setPrev] = useState(livekitRoom);
  if (prev !== livekitRoom) {
    setPrev(livekitRoom);
    setLocalMediaState(getLocalMediaState(livekitRoom));
  }

  useEffect(() => {
    const { localParticipant } = livekitRoom;
    const handleLocalMediaChanged = () => {
      setLocalMediaState(getLocalMediaState(livekitRoom));
    };
    LOCAL_MEDIA_EVENTS.forEach((event) => localParticipant.on(event, handleLocalMediaChanged));
    return () => {
      LOCAL_MEDIA_EVENTS.forEach((event) => localParticipant.off(event, handleLocalMediaChanged));
    };
  }, [livekitRoom]);

  const toggleMicrophone = useCallback(async () => {
    const { localParticipant } = livekitRoom;
    await localParticipant.setMicrophoneEnabled(!localParticipant.isMicrophoneEnabled);
    setLocalMediaState(getLocalMediaState(livekitRoom));
  }, [livekitRoom]);

  const toggleCamera = useCallback(async () => {
    const { localParticipant } = livekitRoom;
    await localParticipant.setCameraEnabled(!localParticipant.isCameraEnabled);
    setLocalMediaState(getLocalMediaState(livekitRoom));
  }, [livekitRoom]);

  const toggleScreenshare = useCallback(async () => {
    const { localParticipant } = livekitRoom;
    await localParticipant.setScreenShareEnabled(!localParticipant.isScreenShareEnabled, {
      audio: true,
    });
    setLocalMediaState(getLocalMediaState(livekitRoom));
  }, [livekitRoom]);

  return { ...localMediaState, toggleMicrophone, toggleCamera, toggleScreenshare };
};
