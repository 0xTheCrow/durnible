import type { MouseEventHandler } from 'react';
import React, { useState } from 'react';
import type { RectCords } from 'folds';
import { Box, Chip, Icon, Icons, Text, config, toRem } from 'folds';
import type { RemoteAudioTrack, RemoteVideoTrack } from 'livekit-client';
import { useCallVideoReceiverStats } from '../../hooks/call/useCallVideoReceiverStats';
import {
  formatKilobitsPerSecond,
  formatPercent,
  formatScreenshareStreamLine,
} from '../../plugins/call/screenshare';
import { CallSpotlightPopOut } from './CallSpotlightPopOut';

type CallVideoReceiverStatsSummaryProps = {
  videoTrack: RemoteVideoTrack;
  audioTrack?: RemoteAudioTrack;
  isScreenshare: boolean;
  isScreenshareAudioEnabled: boolean;
};
function CallVideoReceiverStatsSummary({
  videoTrack,
  audioTrack,
  isScreenshare,
  isScreenshareAudioEnabled,
}: CallVideoReceiverStatsSummaryProps) {
  const receiverStats = useCallVideoReceiverStats(videoTrack, audioTrack);

  const formatDecodingLine = (): string => {
    if (receiverStats?.framesDecodedPerSecond === undefined) return 'unknown';
    return `${Math.round(receiverStats.framesDecodedPerSecond)} fps`;
  };

  const formatPacketsLostLine = (): string => {
    if (receiverStats?.packetsLost === undefined) return 'unknown';
    if (receiverStats.packetsLostFraction === undefined) return `${receiverStats.packetsLost}`;
    return `${receiverStats.packetsLost} (${formatPercent(receiverStats.packetsLostFraction)})`;
  };

  const formatAudioLine = (): string => {
    if (!isScreenshareAudioEnabled) return 'not shared';
    if (receiverStats?.audioBitsPerSecond === undefined) return 'unknown';
    const bitrate = formatKilobitsPerSecond(receiverStats.audioBitsPerSecond);
    if (receiverStats.audioConcealedFraction === undefined) return bitrate;
    return `${bitrate} · ${formatPercent(receiverStats.audioConcealedFraction)} concealed`;
  };

  return (
    <Box direction="Column" data-testid="call-video-receiver-stats">
      <Text size="T200" priority="400">
        Receiving{' '}
        {formatScreenshareStreamLine(
          receiverStats?.frameWidth,
          receiverStats?.frameHeight,
          receiverStats?.framesReceivedPerSecond
        )}
      </Text>
      <Text size="T200" priority="400">
        Decoding {formatDecodingLine()}
      </Text>
      <Text size="T200" priority="400">
        Freezes {receiverStats?.freezeCount ?? 'unknown'}
      </Text>
      <Text size="T200" priority="400">
        Packets lost {formatPacketsLostLine()}
      </Text>
      {isScreenshare && (
        <Text size="T200" priority="400">
          Audio {formatAudioLine()}
        </Text>
      )}
    </Box>
  );
}

type CallVideoReceiverStatsMenuProps = CallVideoReceiverStatsSummaryProps;
export function CallVideoReceiverStatsMenu({
  videoTrack,
  audioTrack,
  isScreenshare,
  isScreenshareAudioEnabled,
}: CallVideoReceiverStatsMenuProps) {
  const [menuAnchor, setMenuAnchor] = useState<RectCords>();

  const handleOpenMenu: MouseEventHandler<HTMLButtonElement> = (evt) => {
    setMenuAnchor(evt.currentTarget.getBoundingClientRect());
  };

  return (
    <CallSpotlightPopOut
      anchor={menuAnchor}
      onClose={() => setMenuAnchor(undefined)}
      content={
        <Box style={{ padding: config.space.S200, width: toRem(232) }}>
          <CallVideoReceiverStatsSummary
            videoTrack={videoTrack}
            audioTrack={audioTrack}
            isScreenshare={isScreenshare}
            isScreenshareAudioEnabled={isScreenshareAudioEnabled}
          />
        </Box>
      }
    >
      <Chip
        as="button"
        size="400"
        onClick={handleOpenMenu}
        aria-pressed={!!menuAnchor}
        aria-label="Stream Stats"
        data-testid="call-video-receiver-stats-menu"
        variant="SurfaceVariant"
        radii="Pill"
        outlined
        before={<Icon size="50" src={Icons.Info} />}
      >
        <Text size="T200">Stats</Text>
      </Chip>
    </CallSpotlightPopOut>
  );
}
