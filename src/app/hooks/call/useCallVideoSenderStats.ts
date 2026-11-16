import { useCallback, useEffect, useState } from 'react';
import type {
  AudioSenderStats,
  LocalAudioTrack,
  LocalVideoTrack,
  VideoSenderStats,
} from 'livekit-client';
import { useInterval } from '../useInterval';
import { getStatRatePerSecond } from '../../plugins/call/rtcStats';

export const CALL_VIDEO_SENDER_STATS_POLL_INTERVAL_MS = 1000;

export type CallVideoSenderStats = {
  captureWidth?: number;
  captureHeight?: number;
  captureFrameRate?: number;
  frameWidth?: number;
  frameHeight?: number;
  framesPerSecond?: number;
  qualityLimitationReason?: string;
  audioBitsPerSecond?: number;
};

const getWidestLayerStats = (layerStats: VideoSenderStats[]): VideoSenderStats | undefined =>
  layerStats.reduce<VideoSenderStats | undefined>((widest, current) => {
    if (!current.frameWidth) return widest;
    if (!widest?.frameWidth || current.frameWidth > widest.frameWidth) return current;
    return widest;
  }, undefined);

export const useCallVideoSenderStats = (
  videoTrack: LocalVideoTrack | undefined,
  audioTrack?: LocalAudioTrack
): CallVideoSenderStats | undefined => {
  const [trackedStats, setTrackedStats] = useState<{
    videoTrack: LocalVideoTrack;
    audioTrack?: LocalAudioTrack;
    audioSenderStats?: AudioSenderStats;
    stats: CallVideoSenderStats;
  }>();

  const recordSenderStatsSample = useCallback(async () => {
    if (!videoTrack) return;
    const [videoLayerStats, audioSenderStats] = await Promise.all([
      videoTrack.getSenderStats(),
      audioTrack?.getSenderStats(),
    ]);
    const widestLayerStats = getWidestLayerStats(videoLayerStats);
    const captureSettings = videoTrack.mediaStreamTrack.getSettings();

    setTrackedStats((previous) => {
      const isSameTracks =
        previous?.videoTrack === videoTrack && previous.audioTrack === audioTrack;
      const audioBytesPerSecond = getStatRatePerSecond(
        isSameTracks ? previous.audioSenderStats : undefined,
        audioSenderStats,
        (stats) => stats.bytesSent
      );
      return {
        videoTrack,
        audioTrack,
        audioSenderStats,
        stats: {
          captureWidth: captureSettings.width,
          captureHeight: captureSettings.height,
          captureFrameRate: captureSettings.frameRate,
          frameWidth: widestLayerStats?.frameWidth,
          frameHeight: widestLayerStats?.frameHeight,
          framesPerSecond: widestLayerStats?.framesPerSecond,
          qualityLimitationReason: widestLayerStats?.qualityLimitationReason,
          audioBitsPerSecond:
            audioBytesPerSecond !== undefined ? audioBytesPerSecond * 8 : undefined,
        },
      };
    });
  }, [videoTrack, audioTrack]);

  useEffect(() => {
    recordSenderStatsSample();
  }, [recordSenderStatsSample]);
  useInterval(recordSenderStatsSample, videoTrack ? CALL_VIDEO_SENDER_STATS_POLL_INTERVAL_MS : -1);

  if (
    !trackedStats ||
    trackedStats.videoTrack !== videoTrack ||
    trackedStats.audioTrack !== audioTrack
  ) {
    return undefined;
  }
  return trackedStats.stats;
};
