import React from 'react';
import type { Room } from 'matrix-js-sdk';
import type { CallMembership } from 'matrix-js-sdk/lib/matrixrtc';
import { Box, Chip, Icon, Icons, Text } from 'folds';
import type { Track as LivekitTrack } from 'livekit-client';
import {
  LocalAudioTrack,
  LocalVideoTrack,
  RemoteAudioTrack,
  RemoteVideoTrack,
  Track,
} from 'livekit-client';
import type { CallParticipantEntry } from '../../hooks/call/useCallParticipantEntries';
import { useParticipantTrackPublications } from '../../hooks/call/useParticipantTrackPublications';
import { useCallVideoReceiverStats } from '../../hooks/call/useCallVideoReceiverStats';
import { useCallVideoSenderStats } from '../../hooks/call/useCallVideoSenderStats';
import { resolveCallParticipant } from '../../utils/call';
import { formatScreenshareStreamLine } from '../../plugins/call/screenshare';
import { CallScreenQualityMenu, ScreenshareSenderStatsSummary } from './CallScreenQualityMenu';
import { CallVideoReceiverStatsMenu } from './CallVideoReceiverStatsMenu';
import * as css from './CallPane.css';

type CallSpotlightStreamLabelProps = {
  videoTrack?: LivekitTrack;
};
function CallSpotlightStreamLabel({ videoTrack }: CallSpotlightStreamLabelProps) {
  const receiverStats = useCallVideoReceiverStats(
    videoTrack instanceof RemoteVideoTrack ? videoTrack : undefined
  );
  const senderStats = useCallVideoSenderStats(
    videoTrack instanceof LocalVideoTrack ? videoTrack : undefined
  );
  const frameWidth = receiverStats?.frameWidth ?? senderStats?.frameWidth;
  const frameHeight = receiverStats?.frameHeight ?? senderStats?.frameHeight;
  const framesPerSecond = receiverStats
    ? receiverStats.framesDecodedPerSecond
    : senderStats?.framesPerSecond;
  if (!frameWidth || !frameHeight) return null;

  return (
    <Text size="T200" priority="400" truncate>
      {formatScreenshareStreamLine(frameWidth, frameHeight, framesPerSecond)}
    </Text>
  );
}

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
  const screenshareAudioTrack = trackPublications.find(
    (publication) => publication.source === Track.Source.ScreenShareAudio
  )?.track;
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
        <CallSpotlightStreamLabel videoTrack={videoTrack} />
      </Box>
      {isOwnScreenshare && (
        <CallScreenQualityMenu
          stats={
            <ScreenshareSenderStatsSummary
              videoTrack={videoTrack instanceof LocalVideoTrack ? videoTrack : undefined}
              audioTrack={
                screenshareAudioTrack instanceof LocalAudioTrack ? screenshareAudioTrack : undefined
              }
              isScreenshareAudioEnabled={entry.isScreenshareAudioEnabled}
            />
          }
        />
      )}
      {videoTrack instanceof RemoteVideoTrack && (
        <CallVideoReceiverStatsMenu
          videoTrack={videoTrack}
          audioTrack={
            entry.isScreensharing && screenshareAudioTrack instanceof RemoteAudioTrack
              ? screenshareAudioTrack
              : undefined
          }
          isScreenshare={entry.isScreensharing}
          isScreenshareAudioEnabled={entry.isScreenshareAudioEnabled}
        />
      )}
      <Chip
        as="button"
        size="400"
        onClick={onStopWatching}
        data-testid="call-spotlight-stop-watching"
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
