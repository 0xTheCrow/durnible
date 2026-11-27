import React from 'react';
import type { Room } from 'matrix-js-sdk';
import type { CallMembership } from 'matrix-js-sdk/lib/matrixrtc';
import { Track } from 'livekit-client';
import { Scroll } from 'folds';
import type { CallParticipantSnapshot } from '../../hooks/call/useCallParticipantSnapshots';
import { checkIsParticipantSnapshotStreamingVideo } from '../../hooks/call/useCallParticipantSnapshots';
import { useCallFocusedParticipantSnapshot } from '../../hooks/call/useCallFocusedParticipantSnapshot';
import { CallParticipantTile } from './CallParticipantTile';
import { CallSpotlightBar } from './CallSpotlightBar';
import { CallTileGrid } from './CallTileGrid';
import * as css from './CallPane.css';

type CallStageProps = {
  room: Room;
  participantSnapshots: CallParticipantSnapshot[];
  memberships: CallMembership[];
  tileAspectRatio?: number;
};
export function CallStage({
  room,
  participantSnapshots,
  memberships,
  tileAspectRatio,
}: CallStageProps) {
  const {
    focusedParticipantSnapshot,
    stripParticipantSnapshots,
    focusParticipant,
    stopWatchingFocusedParticipantSnapshot,
  } = useCallFocusedParticipantSnapshot(participantSnapshots);

  if (!focusedParticipantSnapshot) {
    return (
      <div className={css.CallGridLayout}>
        <CallTileGrid
          room={room}
          participantSnapshots={participantSnapshots}
          memberships={memberships}
          tileAspectRatio={tileAspectRatio}
          onFocus={focusParticipant}
        />
      </div>
    );
  }

  return (
    <div className={css.CallSpotlightLayout}>
      <div className={css.CallSpotlight} data-testid="call-spotlight">
        <CallParticipantTile
          room={room}
          participant={focusedParticipantSnapshot.participant}
          source={
            focusedParticipantSnapshot.isScreensharing
              ? Track.Source.ScreenShare
              : Track.Source.Camera
          }
          memberships={memberships}
          className={css.CallSpotlightTile}
        />
      </div>
      <CallSpotlightBar
        room={room}
        participantSnapshot={focusedParticipantSnapshot}
        memberships={memberships}
        onStopWatching={stopWatchingFocusedParticipantSnapshot}
      />
      <Scroll direction="Horizontal" size="300" hideTrack visibility="Hover">
        <div className={css.CallTileStrip} data-testid="call-tile-strip">
          {stripParticipantSnapshots.map((participantSnapshot) => (
            <CallParticipantTile
              key={participantSnapshot.key}
              room={room}
              participant={participantSnapshot.participant}
              source={Track.Source.Camera}
              memberships={memberships}
              isScreensharing={participantSnapshot.isScreensharing}
              isFocused={participantSnapshot.key === focusedParticipantSnapshot.key}
              className={css.CallStripTile}
              onSelect={
                checkIsParticipantSnapshotStreamingVideo(participantSnapshot)
                  ? focusParticipant
                  : undefined
              }
            />
          ))}
        </div>
      </Scroll>
    </div>
  );
}
