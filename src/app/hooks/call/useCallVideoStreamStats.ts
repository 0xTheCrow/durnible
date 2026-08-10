import { useCallback, useRef, useState } from 'react';
import type { RemoteVideoTrack } from 'livekit-client';
import { useInterval } from '../useInterval';

export const CALL_VIDEO_STATS_POLL_INTERVAL_MS = 1000;

export type CallVideoStreamStats = {
  frameWidth?: number;
  frameHeight?: number;
  framesPerSecond?: number;
};

type CallVideoStreamSample = {
  track: RemoteVideoTrack;
  framesDecoded: number;
  timestamp: number;
};

export const useCallVideoStreamStats = (
  track: RemoteVideoTrack | undefined
): CallVideoStreamStats | undefined => {
  const [trackedStats, setTrackedStats] = useState<{
    track: RemoteVideoTrack;
    stats: CallVideoStreamStats;
  }>();
  const previousSampleRef = useRef<CallVideoStreamSample>();

  const pollStats = useCallback(async () => {
    if (!track) return;
    const receiverStats = await track.getReceiverStats();
    if (!receiverStats) return;

    const { frameWidth, frameHeight, framesDecoded, timestamp } = receiverStats;
    const previousSample = previousSampleRef.current;
    previousSampleRef.current = { track, framesDecoded, timestamp };

    const elapsedSeconds =
      previousSample?.track === track ? (timestamp - previousSample.timestamp) / 1000 : 0;
    const framesPerSecond =
      previousSample && elapsedSeconds > 0
        ? Math.round((framesDecoded - previousSample.framesDecoded) / elapsedSeconds)
        : undefined;

    setTrackedStats({ track, stats: { frameWidth, frameHeight, framesPerSecond } });
  }, [track]);

  useInterval(pollStats, track ? CALL_VIDEO_STATS_POLL_INTERVAL_MS : -1);

  if (!trackedStats || trackedStats.track !== track) return undefined;
  return trackedStats.stats;
};
