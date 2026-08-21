import React, { useRef } from 'react';
import type { Room } from 'matrix-js-sdk';
import type { CallMembership } from 'matrix-js-sdk/lib/matrixrtc';
import { Track } from 'livekit-client';
import { Box, Icon, Icons, Scroll, Text } from 'folds';
import classNames from 'classnames';
import type { CallParticipantEntry } from '../../hooks/call/useCallParticipantEntries';
import { checkIsEntryStreamingVideo } from '../../hooks/call/useCallParticipantEntries';
import { useCallTileGridLayout } from '../../hooks/call/useCallTileGridLayout';
import { CALL_TILE_GAP, resolveCallParticipant } from '../../utils/call';
import { CallMemberAvatar } from './CallMemberAvatar';
import { CallParticipantTile } from './CallParticipantTile';
import { useIsParticipantSpeaking } from '../../hooks/call/useIsParticipantSpeaking';
import { useCallUserVolumeMenu } from './useCallUserVolumeMenu';
import * as css from './CallPane.css';

type CallOverflowParticipantProps = {
  room: Room;
  entry: CallParticipantEntry;
  memberships: CallMembership[];
  onSelect?: (participantIdentity: string) => void;
};
function CallOverflowParticipantComponent({
  room,
  entry,
  memberships,
  onSelect,
}: CallOverflowParticipantProps) {
  const isSpeaking = useIsParticipantSpeaking(entry.participant);
  const { userId, displayName } = resolveCallParticipant(
    room,
    entry.participant.identity,
    memberships
  );
  const { handleContextMenu, volumeMenu } = useCallUserVolumeMenu(
    userId,
    displayName,
    entry.isScreenshareAudioEnabled
  );

  const participantContent = (
    <>
      {userId ? (
        <CallMemberAvatar room={room} userId={userId} size="200" textSize="O400" />
      ) : (
        <Icon size="50" src={Icons.User} />
      )}
      {entry.isScreensharing && <Icon size="50" src={Icons.Monitor} filled />}
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
          onClick={() => onSelect(entry.participant.identity)}
          onContextMenu={handleContextMenu}
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
          onContextMenu={handleContextMenu}
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
  entries: CallParticipantEntry[];
  memberships: CallMembership[];
  tileAspectRatio?: number;
  onFocus: (key: string) => void;
};
export function CallTileGrid({
  room,
  entries,
  memberships,
  tileAspectRatio,
  onFocus,
}: CallTileGridProps) {
  const gridAreaRef = useRef<HTMLDivElement>(null);
  const { columnCount, tileWidth, tileHeight, visibleTileCount } = useCallTileGridLayout(
    gridAreaRef,
    entries.length,
    tileAspectRatio
  );

  const visibleEntries = entries.slice(0, visibleTileCount);
  const overflowEntries = entries.slice(visibleTileCount);

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
        {visibleEntries.map((entry) => (
          <CallParticipantTile
            key={entry.key}
            room={room}
            participant={entry.participant}
            source={Track.Source.Camera}
            memberships={memberships}
            isScreensharing={entry.isScreensharing}
            className={css.CallGridTile}
            onSelect={checkIsEntryStreamingVideo(entry) ? onFocus : undefined}
          />
        ))}
      </div>
      {overflowEntries.length > 0 && (
        <Scroll direction="Horizontal" size="300" hideTrack visibility="Hover">
          <Box className={css.CallOverflowRow} alignItems="Center" gap="200">
            {overflowEntries.map((entry) => (
              <CallOverflowParticipant
                key={entry.key}
                room={room}
                entry={entry}
                memberships={memberships}
                onSelect={checkIsEntryStreamingVideo(entry) ? onFocus : undefined}
              />
            ))}
          </Box>
        </Scroll>
      )}
    </div>
  );
}
