import type {
  AudioPreset,
  LocalAudioTrack,
  LocalVideoTrack,
  ScreenShareCaptureOptions,
  VideoEncoding,
} from 'livekit-client';
import type {
  ScreenshareAudioBitrateKbps,
  ScreenshareMaxFrameRate,
  ScreenshareResolution,
} from '../../state/settings';

const BASE_FRAME_RATE = 30;

type ScreenshareResolutionSpec = {
  width: number;
  height: number;
  baseBitrate: number;
  label: string;
};

export const SCREENSHARE_RESOLUTIONS: Record<ScreenshareResolution, ScreenshareResolutionSpec> = {
  '720p': { width: 1280, height: 720, baseBitrate: 1_500_000, label: '720p' },
  '1080p': { width: 1920, height: 1080, baseBitrate: 5_000_000, label: '1080p' },
  '1440p': { width: 2560, height: 1440, baseBitrate: 8_000_000, label: '1440p' },
};

export const SCREENSHARE_RESOLUTION_OPTIONS: ScreenshareResolution[] = ['720p', '1080p', '1440p'];

export const SCREENSHARE_MAX_FRAME_RATE_OPTIONS: ScreenshareMaxFrameRate[] = [15, 30, 60];

export const SCREENSHARE_AUDIO_BITRATE_KBPS_OPTIONS: ScreenshareAudioBitrateKbps[] = [
  48, 64, 96, 128,
];

export const formatScreenshareStreamLine = (
  width: number | undefined,
  height: number | undefined,
  frameRate: number | undefined
): string => {
  const size = width && height ? `${width}×${height}` : 'unknown';
  const rate = frameRate !== undefined ? `${Math.round(frameRate)} fps` : 'unknown';
  return `${size} · ${rate}`;
};

export const getScreenshareCaptureOptions = (
  resolution: ScreenshareResolution,
  maxFrameRate: ScreenshareMaxFrameRate,
  isAudioProcessingEnabled = false
): ScreenShareCaptureOptions => {
  const { width, height } = SCREENSHARE_RESOLUTIONS[resolution];
  return {
    audio: {
      echoCancellation: isAudioProcessingEnabled,
      noiseSuppression: isAudioProcessingEnabled,
      autoGainControl: isAudioProcessingEnabled,
      restrictOwnAudio: true,
    },
    resolution: { width, height, frameRate: maxFrameRate },
    contentHint: 'motion',
  };
};

export const getScreenshareEncoding = (
  resolution: ScreenshareResolution,
  maxFrameRate: ScreenshareMaxFrameRate
): VideoEncoding => {
  const { baseBitrate } = SCREENSHARE_RESOLUTIONS[resolution];
  return {
    maxBitrate: Math.round((baseBitrate * maxFrameRate) / BASE_FRAME_RATE),
    maxFramerate: maxFrameRate,
  };
};

export const applyScreenshareQuality = async (
  track: LocalVideoTrack,
  resolution: ScreenshareResolution,
  maxFrameRate: ScreenshareMaxFrameRate
): Promise<void> => {
  const { width, height } = SCREENSHARE_RESOLUTIONS[resolution];
  const { mediaStreamTrack } = track;
  mediaStreamTrack.contentHint = 'motion';
  await mediaStreamTrack.applyConstraints({
    width: { ideal: width },
    height: { ideal: height },
    frameRate: { ideal: maxFrameRate },
  });

  const { sender } = track;
  if (!sender) return;
  const { maxBitrate, maxFramerate } = getScreenshareEncoding(resolution, maxFrameRate);
  const parameters = sender.getParameters();
  parameters.encodings = parameters.encodings.map((layerEncoding) => ({
    ...layerEncoding,
    maxFramerate,
    maxBitrate: Math.round(maxBitrate / (layerEncoding.scaleResolutionDownBy ?? 1) ** 2),
  }));
  await sender.setParameters(parameters);
};

export const getScreenshareAudioPreset = (
  bitrateKbps: ScreenshareAudioBitrateKbps
): AudioPreset => ({
  maxBitrate: bitrateKbps * 1000,
});

export const applyScreenshareAudioBitrate = async (
  track: LocalAudioTrack,
  bitrateKbps: ScreenshareAudioBitrateKbps
): Promise<void> => {
  const { sender } = track;
  if (!sender) return;
  const { maxBitrate } = getScreenshareAudioPreset(bitrateKbps);
  const parameters = sender.getParameters();
  parameters.encodings = parameters.encodings.map((encoding) => ({ ...encoding, maxBitrate }));
  await sender.setParameters(parameters);
};
