import type { Room as LivekitRoom } from 'livekit-client';
import { isIOS } from '../../utils/user-agent';

export type CallPlaybackAudioContexts = {
  allTracksAudioContext: AudioContext | undefined;
  screenshareAudioContext: AudioContext | undefined;
};

const DEFAULT_AUDIO_OUTPUT_DEVICE_ID = 'default';
const AUDIO_CONTEXT_DEFAULT_SINK_ID = '';

const checkCanAudioContextSelectOutputDevice = (): boolean =>
  typeof AudioContext !== 'undefined' && 'setSinkId' in AudioContext.prototype;

export const createCallPlaybackAudioContexts = (): CallPlaybackAudioContexts => ({
  allTracksAudioContext: isIOS() ? new AudioContext() : undefined,
  screenshareAudioContext: checkCanAudioContextSelectOutputDevice()
    ? new AudioContext()
    : undefined,
});

export const closeCallPlaybackAudioContexts = ({
  allTracksAudioContext,
  screenshareAudioContext,
}: CallPlaybackAudioContexts): void => {
  allTracksAudioContext?.close();
  screenshareAudioContext?.close();
};

export const applyCallAudioOutputDevice = async (
  livekitRoom: LivekitRoom,
  { screenshareAudioContext }: CallPlaybackAudioContexts,
  audioOutputDeviceId: string
): Promise<void> => {
  await livekitRoom.switchActiveDevice('audiooutput', audioOutputDeviceId);
  await screenshareAudioContext?.setSinkId(
    audioOutputDeviceId === DEFAULT_AUDIO_OUTPUT_DEVICE_ID
      ? AUDIO_CONTEXT_DEFAULT_SINK_ID
      : audioOutputDeviceId
  );
};
