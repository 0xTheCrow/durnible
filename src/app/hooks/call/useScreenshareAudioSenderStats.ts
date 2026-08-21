import { useCallback, useState } from 'react';
import type { LocalAudioTrack } from 'livekit-client';
import { useInterval } from '../useInterval';

export const SCREENSHARE_AUDIO_SENDER_STATS_POLL_INTERVAL_MS = 1000;

export type ScreenshareAudioSenderStats = {
  bitsPerSecond: number;
};

type ScreenshareAudioSenderSample = {
  bytesSent: number;
  timestamp: number;
};

export const useScreenshareAudioSenderStats = (
  track: LocalAudioTrack | undefined
): ScreenshareAudioSenderStats | undefined => {
  const [trackedStats, setTrackedStats] = useState<{
    track: LocalAudioTrack;
    sample: ScreenshareAudioSenderSample;
    stats?: ScreenshareAudioSenderStats;
  }>();

  const pollStats = useCallback(async () => {
    if (!track) return;
    const senderStats = await track.getSenderStats();
    if (senderStats?.bytesSent === undefined) return;
    const sample: ScreenshareAudioSenderSample = {
      bytesSent: senderStats.bytesSent,
      timestamp: senderStats.timestamp,
    };

    setTrackedStats((previous) => {
      const previousSample = previous?.track === track ? previous.sample : undefined;
      const elapsedSeconds = previousSample
        ? (sample.timestamp - previousSample.timestamp) / 1000
        : 0;
      if (!previousSample || elapsedSeconds <= 0) return { track, sample };
      return {
        track,
        sample,
        stats: {
          bitsPerSecond: ((sample.bytesSent - previousSample.bytesSent) * 8) / elapsedSeconds,
        },
      };
    });
  }, [track]);

  useInterval(pollStats, track ? SCREENSHARE_AUDIO_SENDER_STATS_POLL_INTERVAL_MS : -1);

  if (!trackedStats || trackedStats.track !== track) return undefined;
  return trackedStats.stats;
};
