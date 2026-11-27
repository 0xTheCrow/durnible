export type InboundRtpStats = RTCInboundRtpStreamStats & { freezeCount?: number };

export const findInboundRtpStats = (
  statsReport: RTCStatsReport | undefined
): InboundRtpStats | undefined => {
  let inboundRtpStats: InboundRtpStats | undefined;
  statsReport?.forEach((stats) => {
    if (stats.type === 'inbound-rtp') inboundRtpStats = stats;
  });
  return inboundRtpStats;
};

export const getStatRatePerSecond = <Stats extends { timestamp: number }>(
  previousStats: Stats | undefined,
  currentStats: Stats | undefined,
  readCounter: (stats: Stats) => number | undefined
): number | undefined => {
  if (!previousStats || !currentStats) return undefined;
  const previousCount = readCounter(previousStats);
  const currentCount = readCounter(currentStats);
  if (previousCount === undefined || currentCount === undefined) return undefined;
  const elapsedSeconds = (currentStats.timestamp - previousStats.timestamp) / 1000;
  if (elapsedSeconds <= 0) return undefined;
  return (currentCount - previousCount) / elapsedSeconds;
};

export const getFraction = (
  part: number | undefined,
  whole: number | undefined
): number | undefined => {
  if (part === undefined || whole === undefined || whole <= 0) return undefined;
  return part / whole;
};
