import { useCallback, useEffect, useState } from 'react';
import type { RemoteAudioTrack, RemoteVideoTrack } from 'livekit-client';
import { useInterval } from '../useInterval';
import type { InboundRtpStats } from '../../plugins/call/rtcStats';
import {
  findInboundRtpStats,
  getFraction,
  getStatRatePerSecond,
} from '../../plugins/call/rtcStats';

export const CALL_VIDEO_RECEIVER_STATS_POLL_INTERVAL_MS = 1000;

export type CallVideoReceiverStats = {
  frameWidth?: number;
  frameHeight?: number;
  framesReceivedPerSecond?: number;
  framesDecodedPerSecond?: number;
  freezeCount?: number;
  packetsLost?: number;
  packetsLostFraction?: number;
  audioBitsPerSecond?: number;
  audioConcealedFraction?: number;
};

type CallVideoReceiverSample = {
  videoTrack: RemoteVideoTrack;
  audioTrack?: RemoteAudioTrack;
  videoInboundStats?: InboundRtpStats;
  audioInboundStats?: InboundRtpStats;
  stats: CallVideoReceiverStats;
};

const getPacketsLostFraction = (videoInboundStats: InboundRtpStats): number | undefined => {
  const { packetsLost, packetsReceived } = videoInboundStats;
  if (packetsLost === undefined || packetsReceived === undefined) return undefined;
  return getFraction(packetsLost, packetsLost + packetsReceived);
};

export const useCallVideoReceiverStats = (
  videoTrack: RemoteVideoTrack | undefined,
  audioTrack?: RemoteAudioTrack
): CallVideoReceiverStats | undefined => {
  const [trackedSample, setTrackedSample] = useState<CallVideoReceiverSample>();

  const recordReceiverStatsSample = useCallback(async () => {
    if (!videoTrack) return;
    const [videoStatsReport, audioStatsReport] = await Promise.all([
      videoTrack.getRTCStatsReport(),
      audioTrack?.getRTCStatsReport(),
    ]);
    const videoInboundStats = findInboundRtpStats(videoStatsReport);
    const audioInboundStats = findInboundRtpStats(audioStatsReport);

    setTrackedSample((previous) => {
      const isSameTracks =
        previous?.videoTrack === videoTrack && previous.audioTrack === audioTrack;
      const previousVideoInboundStats = isSameTracks ? previous.videoInboundStats : undefined;
      const previousAudioInboundStats = isSameTracks ? previous.audioInboundStats : undefined;
      const audioBytesPerSecond = getStatRatePerSecond(
        previousAudioInboundStats,
        audioInboundStats,
        (stats) => stats.bytesReceived
      );
      return {
        videoTrack,
        audioTrack,
        videoInboundStats,
        audioInboundStats,
        stats: {
          frameWidth: videoInboundStats?.frameWidth,
          frameHeight: videoInboundStats?.frameHeight,
          framesReceivedPerSecond: getStatRatePerSecond(
            previousVideoInboundStats,
            videoInboundStats,
            (stats) => stats.framesReceived
          ),
          framesDecodedPerSecond: getStatRatePerSecond(
            previousVideoInboundStats,
            videoInboundStats,
            (stats) => stats.framesDecoded
          ),
          freezeCount: videoInboundStats?.freezeCount,
          packetsLost: videoInboundStats?.packetsLost,
          packetsLostFraction: videoInboundStats && getPacketsLostFraction(videoInboundStats),
          audioBitsPerSecond:
            audioBytesPerSecond !== undefined ? audioBytesPerSecond * 8 : undefined,
          audioConcealedFraction: getFraction(
            audioInboundStats?.concealedSamples,
            audioInboundStats?.totalSamplesReceived
          ),
        },
      };
    });
  }, [videoTrack, audioTrack]);

  useEffect(() => {
    recordReceiverStatsSample();
  }, [recordReceiverStatsSample]);
  useInterval(
    recordReceiverStatsSample,
    videoTrack ? CALL_VIDEO_RECEIVER_STATS_POLL_INTERVAL_MS : -1
  );

  if (
    !trackedSample ||
    trackedSample.videoTrack !== videoTrack ||
    trackedSample.audioTrack !== audioTrack
  ) {
    return undefined;
  }
  return trackedSample.stats;
};
