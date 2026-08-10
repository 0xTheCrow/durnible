import React from 'react';
import type { Room } from 'matrix-js-sdk';
import type { CallMembership } from 'matrix-js-sdk/lib/matrixrtc';
import { Box, Chip, Icon, Icons, Text } from 'folds';
import { LocalVideoTrack, RemoteVideoTrack, Track } from 'livekit-client';
import type { CallParticipantEntry } from '../../hooks/call/useCallParticipantEntries';
import { useParticipantTrackPublications } from '../../hooks/call/useParticipantTrackPublications';
import { useCallVideoStreamStats } from '../../hooks/call/useCallVideoStreamStats';
import { useScreenshareSenderStats } from '../../hooks/call/useScreenshareSenderStats';
import { resolveCallParticipant } from '../../utils/call';
import { CallScreenQualityMenu } from './CallScreenQualityMenu';
import * as css from './CallPane.css';

const getResolutionLabel = (stats: {
  frameWidth?: number;
  frameHeight?: number;
}): string | undefined => {
  if (!stats.frameWidth || !stats.frameHeight) return undefined;
  return `${stats.frameWidth}×${stats.frameHeight}`;
};

type CallSpotlightBarProps = {
  room: Room;
  entry: CallParticipantEntry;
  memberships: CallMembership[];
  onStopWatching: () => void;
};
export function CallSpotlightBar({
  room,
  entry,
  memberships,
  onStopWatching,
}: CallSpotlightBarProps) {
  const { displayName } = resolveCallParticipant(room, entry.participant.identity, memberships);
  const trackPublications = useParticipantTrackPublications(entry.participant);

  const source = entry.isScreensharing ? Track.Source.ScreenShare : Track.Source.Camera;
  const videoTrack = trackPublications.find((publication) => publication.source === source)?.track;
  const receiverStats = useCallVideoStreamStats(
    videoTrack instanceof RemoteVideoTrack ? videoTrack : undefined
  );
  const senderStats = useScreenshareSenderStats(
    videoTrack instanceof LocalVideoTrack ? videoTrack : undefined
  );
  const stats = receiverStats ?? senderStats;
  const resolutionLabel = stats && getResolutionLabel(stats);
  const isOwnScreenshare = entry.participant.isLocal && entry.isScreensharing;

  const getWatchingLabel = (): string => {
    if (!entry.isScreensharing) return `Watching ${displayName}`;
    if (entry.participant.isLocal) return 'Watching your screen';
    return `Watching ${displayName}'s screen`;
  };

  return (
    <Box className={css.CallSpotlightBar} alignItems="Center" gap="200">
      <Box grow="Yes" alignItems="Baseline" gap="200">
        <Text size="T200" priority="300" truncate>
          {getWatchingLabel()}
        </Text>
        {resolutionLabel && (
          <Text size="T200" priority="400" truncate>
            {resolutionLabel}
          </Text>
        )}
      </Box>
      {isOwnScreenshare && <CallScreenQualityMenu senderStats={senderStats} />}
      <Chip
        as="button"
        size="400"
        onClick={onStopWatching}
        variant="SurfaceVariant"
        radii="Pill"
        outlined
        before={<Icon size="50" src={Icons.Cross} />}
      >
        <Text size="T200">Stop Watching</Text>
      </Chip>
    </Box>
  );
}
