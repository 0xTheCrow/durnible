import { useCallback, useEffect, useState } from 'react';
import type { Room as LivekitRoom } from 'livekit-client';
import { LocalAudioTrack, LocalVideoTrack, ParticipantEvent, Track } from 'livekit-client';
import { settingsAtom } from '../../state/settings';
import { useSetting } from '../../state/hooks/settings';
import {
  applyScreenshareAudioBitrate,
  applyScreenshareQuality,
  getScreenshareAudioPreset,
  getScreenshareCaptureOptions,
  getScreenshareEncoding,
} from '../../plugins/call/screenshare';

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
  const [screenshareResolution] = useSetting(settingsAtom, 'screenshareResolution');
  const [screenshareMaxFrameRate] = useSetting(settingsAtom, 'screenshareMaxFrameRate');
  const [screenshareAudioBitrateKbps] = useSetting(settingsAtom, 'screenshareAudioBitrateKbps');
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

  useEffect(() => {
    if (!localMediaState.isScreenshareEnabled) return;
    const screenshareTrack = livekitRoom.localParticipant.getTrackPublication(
      Track.Source.ScreenShare
    )?.track;
    if (!(screenshareTrack instanceof LocalVideoTrack)) return;

    applyScreenshareQuality(screenshareTrack, screenshareResolution, screenshareMaxFrameRate).catch(
      (error) => console.error('useLocalMediaControls: failed to apply screenshare quality', error)
    );
  }, [
    livekitRoom,
    localMediaState.isScreenshareEnabled,
    screenshareResolution,
    screenshareMaxFrameRate,
  ]);

  useEffect(() => {
    if (!localMediaState.isScreenshareEnabled) return;
    const screenshareAudioTrack = livekitRoom.localParticipant.getTrackPublication(
      Track.Source.ScreenShareAudio
    )?.track;
    if (!(screenshareAudioTrack instanceof LocalAudioTrack)) return;

    applyScreenshareAudioBitrate(screenshareAudioTrack, screenshareAudioBitrateKbps).catch(
      (error) =>
        console.error('useLocalMediaControls: failed to apply screenshare audio bitrate', error)
    );
  }, [livekitRoom, localMediaState.isScreenshareEnabled, screenshareAudioBitrateKbps]);

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
    try {
      await localParticipant.setScreenShareEnabled(
        !localParticipant.isScreenShareEnabled,
        getScreenshareCaptureOptions(screenshareResolution, screenshareMaxFrameRate),
        {
          screenShareEncoding: getScreenshareEncoding(
            screenshareResolution,
            screenshareMaxFrameRate
          ),
          degradationPreference: 'maintain-framerate',
          audioPreset: getScreenshareAudioPreset(screenshareAudioBitrateKbps),
        }
      );
    } catch (error) {
      const isCancelled =
        error instanceof DOMException &&
        (error.name === 'NotAllowedError' || error.name === 'AbortError');
      if (!isCancelled) {
        console.error('useLocalMediaControls: failed to toggle screenshare', error);
      }
    }
    setLocalMediaState(getLocalMediaState(livekitRoom));
  }, [livekitRoom, screenshareResolution, screenshareMaxFrameRate, screenshareAudioBitrateKbps]);

  return { ...localMediaState, toggleMicrophone, toggleCamera, toggleScreenshare };
};
