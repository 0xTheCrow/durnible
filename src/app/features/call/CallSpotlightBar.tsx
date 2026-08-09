import React from 'react';
import type { Room } from 'matrix-js-sdk';
import type { CallMembership } from 'matrix-js-sdk/lib/matrixrtc';
import { Box, Chip, Icon, Icons, Text } from 'folds';
import { RemoteVideoTrack, Track } from 'livekit-client';
import type { CallParticipantEntry } from '../../hooks/call/useCallParticipantEntries';
import { useParticipantTrackPublications } from '../../hooks/call/useParticipantTrackPublications';
import type { CallVideoStreamStats } from '../../hooks/call/useCallVideoStreamStats';
import { useCallVideoStreamStats } from '../../hooks/call/useCallVideoStreamStats';
import { resolveCallParticipant } from '../../utils/call';
import * as css from './CallPane.css';

const getStreamStatsLabel = (stats: CallVideoStreamStats): string | undefined => {
  const parts: string[] = [];
  if (stats.frameWidth && stats.frameHeight) parts.push(`${stats.frameWidth}×${stats.frameHeight}`);
  if (stats.framesPerSecond !== undefined) parts.push(`${stats.framesPerSecond} fps`);
  return parts.length > 0 ? parts.join(' · ') : undefined;
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
  const stats = useCallVideoStreamStats(
    videoTrack instanceof RemoteVideoTrack ? videoTrack : undefined
  );
  const streamStatsLabel = stats && getStreamStatsLabel(stats);

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
        {streamStatsLabel && (
          <Text size="T200" priority="400" truncate>
            {streamStatsLabel}
          </Text>
        )}
      </Box>
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
