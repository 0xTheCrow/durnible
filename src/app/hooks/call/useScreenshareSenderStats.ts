import { useCallback, useState } from 'react';
import type { LocalVideoTrack, VideoSenderStats } from 'livekit-client';
import { useInterval } from '../useInterval';

export const SCREENSHARE_SENDER_STATS_POLL_INTERVAL_MS = 1000;

export type ScreenshareSenderStats = {
  captureWidth?: number;
  captureHeight?: number;
  captureFrameRate?: number;
  frameWidth?: number;
  frameHeight?: number;
  framesPerSecond?: number;
  qualityLimitationReason?: string;
};

const getWidestLayerStats = (layerStats: VideoSenderStats[]): VideoSenderStats | undefined =>
  layerStats.reduce<VideoSenderStats | undefined>((widest, current) => {
    if (!current.frameWidth) return widest;
    if (!widest?.frameWidth || current.frameWidth > widest.frameWidth) return current;
    return widest;
  }, undefined);

export const useScreenshareSenderStats = (
  track: LocalVideoTrack | undefined
): ScreenshareSenderStats | undefined => {
  const [trackedStats, setTrackedStats] = useState<{
    track: LocalVideoTrack;
    stats: ScreenshareSenderStats;
  }>();

  const pollStats = useCallback(async () => {
    if (!track) return;
    const widestLayerStats = getWidestLayerStats(await track.getSenderStats());
    const captureSettings = track.mediaStreamTrack.getSettings();

    setTrackedStats({
      track,
      stats: {
        captureWidth: captureSettings.width,
        captureHeight: captureSettings.height,
        captureFrameRate: captureSettings.frameRate,
        frameWidth: widestLayerStats?.frameWidth,
        frameHeight: widestLayerStats?.frameHeight,
        framesPerSecond: widestLayerStats?.framesPerSecond,
        qualityLimitationReason: widestLayerStats?.qualityLimitationReason,
      },
    });
  }, [track]);

  useInterval(pollStats, track ? SCREENSHARE_SENDER_STATS_POLL_INTERVAL_MS : -1);

  if (!trackedStats || trackedStats.track !== track) return undefined;
  return trackedStats.stats;
};
