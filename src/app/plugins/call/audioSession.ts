type AudioSessionType =
  | 'auto'
  | 'playback'
  | 'transient'
  | 'transient-solo'
  | 'ambient'
  | 'play-and-record';

declare global {
  interface Navigator {
    audioSession?: { type: AudioSessionType };
  }
}

export const setAudioSessionType = (type: AudioSessionType): void => {
  if (navigator.audioSession) navigator.audioSession.type = type;
};
