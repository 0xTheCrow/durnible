import React, { useRef } from 'react';
import type { Room } from 'matrix-js-sdk';
import type { CallMembership } from 'matrix-js-sdk/lib/matrixrtc';
import { Track } from 'livekit-client';
import { Box, Icon, Icons, Scroll, Text } from 'folds';
import classNames from 'classnames';
import type { CallParticipantSnapshot } from '../../hooks/call/useCallParticipantSnapshots';
import { checkIsParticipantSnapshotStreamingVideo } from '../../hooks/call/useCallParticipantSnapshots';
import { useCallTileGridLayout } from '../../hooks/call/useCallTileGridLayout';
import { CALL_TILE_GAP, resolveCallParticipant } from '../../utils/call';
import { CallMemberAvatar } from './CallMemberAvatar';
import { CallParticipantTile } from './CallParticipantTile';
import { useIsParticipantSpeaking } from '../../hooks/call/useIsParticipantSpeaking';
import { useCallUserVolumeMenu } from './useCallUserVolumeMenu';
import * as css from './CallPane.css';

type CallOverflowParticipantProps = {
  room: Room;
  participantSnapshot: CallParticipantSnapshot;
  memberships: CallMembership[];
  onSelect?: (participantIdentity: string) => void;
};
function CallOverflowParticipantComponent({
  room,
  participantSnapshot,
  memberships,
  onSelect,
}: CallOverflowParticipantProps) {
  const isSpeaking = useIsParticipantSpeaking(participantSnapshot.participant);
  const { userId, displayName } = resolveCallParticipant(
    room,
    participantSnapshot.participant.identity,
    memberships
  );
  const { volumeMenuTriggerProps, volumeMenu } = useCallUserVolumeMenu(
    userId,
    displayName,
    participantSnapshot.isScreenshareAudioEnabled
  );

  const participantContent = (
    <>
      {userId ? (
        <CallMemberAvatar room={room} userId={userId} size="200" textSize="O400" />
      ) : (
        <Icon size="50" src={Icons.User} />
      )}
      {participantSnapshot.isScreensharing && <Icon size="50" src={Icons.Monitor} filled />}
      <Text as="span" size="T200" truncate>
        {displayName}
      </Text>
    </>
  );

  const participantClassName = classNames(
    css.CallOverflowParticipant,
    isSpeaking && css.CallOverflowParticipantSpeaking
  );

  return (
    <>
      {onSelect ? (
        <Box
          as="button"
          type="button"
          onClick={() => onSelect(participantSnapshot.participant.identity)}
          {...volumeMenuTriggerProps}
          aria-label={`Focus ${displayName}`}
          className={participantClassName}
          alignItems="Center"
          gap="100"
          shrink="No"
        >
          {participantContent}
        </Box>
      ) : (
        <Box
          {...volumeMenuTriggerProps}
          className={participantClassName}
          alignItems="Center"
          gap="100"
          shrink="No"
        >
          {participantContent}
        </Box>
      )}
      {volumeMenu}
    </>
  );
}

const CallOverflowParticipant = React.memo(CallOverflowParticipantComponent);

type CallTileGridProps = {
  room: Room;
  participantSnapshots: CallParticipantSnapshot[];
  memberships: CallMembership[];
  tileAspectRatio?: number;
  onFocus: (key: string) => void;
};
export function CallTileGrid({
  room,
  participantSnapshots,
  memberships,
  tileAspectRatio,
  onFocus,
}: CallTileGridProps) {
  const gridAreaRef = useRef<HTMLDivElement>(null);
  const { columnCount, tileWidth, tileHeight, visibleTileCount } = useCallTileGridLayout(
    gridAreaRef,
    participantSnapshots.length,
    tileAspectRatio
  );

  const visibleParticipantSnapshots = participantSnapshots.slice(0, visibleTileCount);
  const overflowParticipantSnapshots = participantSnapshots.slice(visibleTileCount);

  return (
    <div ref={gridAreaRef} className={css.CallTileGridArea} style={{ gap: CALL_TILE_GAP }}>
      <div
        className={css.CallTileGrid}
        style={{
          gridTemplateColumns: `repeat(${columnCount}, ${tileWidth}px)`,
          gridAutoRows: `${tileHeight}px`,
          gap: CALL_TILE_GAP,
        }}
      >
        {visibleParticipantSnapshots.map((participantSnapshot) => (
          <CallParticipantTile
            key={participantSnapshot.key}
            room={room}
            participant={participantSnapshot.participant}
            source={Track.Source.Camera}
            memberships={memberships}
            isScreensharing={participantSnapshot.isScreensharing}
            className={css.CallGridTile}
            onSelect={
              checkIsParticipantSnapshotStreamingVideo(participantSnapshot) ? onFocus : undefined
            }
          />
        ))}
      </div>
      {overflowParticipantSnapshots.length > 0 && (
        <Scroll direction="Horizontal" size="300" hideTrack visibility="Hover">
          <Box className={css.CallOverflowRow} alignItems="Center" gap="200">
            {overflowParticipantSnapshots.map((participantSnapshot) => (
              <CallOverflowParticipant
                key={participantSnapshot.key}
                room={room}
                participantSnapshot={participantSnapshot}
                memberships={memberships}
                onSelect={
                  checkIsParticipantSnapshotStreamingVideo(participantSnapshot)
                    ? onFocus
                    : undefined
                }
              />
            ))}
          </Box>
        </Scroll>
      )}
    </div>
  );
}
