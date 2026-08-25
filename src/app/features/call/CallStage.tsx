import React from 'react';
import type { Room } from 'matrix-js-sdk';
import type { CallMembership } from 'matrix-js-sdk/lib/matrixrtc';
import { Track } from 'livekit-client';
import { Scroll } from 'folds';
import type { CallParticipantEntry } from '../../hooks/call/useCallParticipantEntries';
import { checkIsEntryStreamingVideo } from '../../hooks/call/useCallParticipantEntries';
import { useCallFocusedEntry } from '../../hooks/call/useCallFocusedEntry';
import { CallParticipantTile } from './CallParticipantTile';
import { CallSpotlightBar } from './CallSpotlightBar';
import { CallTileGrid } from './CallTileGrid';
import * as css from './CallPane.css';

type CallStageProps = {
  room: Room;
  entries: CallParticipantEntry[];
  memberships: CallMembership[];
  tileAspectRatio?: number;
};
export function CallStage({ room, entries, memberships, tileAspectRatio }: CallStageProps) {
  const { focusedEntry, stripEntries, focusEntry, stopWatchingFocusedEntry } =
    useCallFocusedEntry(entries);

  if (!focusedEntry) {
    return (
      <div className={css.CallGridLayout}>
        <CallTileGrid
          room={room}
          entries={entries}
          memberships={memberships}
          tileAspectRatio={tileAspectRatio}
          onFocus={focusEntry}
        />
      </div>
    );
  }

  return (
    <div className={css.CallSpotlightLayout}>
      <div className={css.CallSpotlight}>
        <CallParticipantTile
          room={room}
          participant={focusedEntry.participant}
          source={focusedEntry.isScreensharing ? Track.Source.ScreenShare : Track.Source.Camera}
          memberships={memberships}
          className={css.CallSpotlightTile}
        />
      </div>
      <CallSpotlightBar
        room={room}
        entry={focusedEntry}
        memberships={memberships}
        onStopWatching={stopWatchingFocusedEntry}
      />
      <Scroll direction="Horizontal" size="300" hideTrack visibility="Hover">
        <div className={css.CallTileStrip}>
          {stripEntries.map((entry) => (
            <CallParticipantTile
              key={entry.key}
              room={room}
              participant={entry.participant}
              source={Track.Source.Camera}
              memberships={memberships}
              isScreensharing={entry.isScreensharing}
              isFocused={entry.key === focusedEntry.key}
              className={css.CallStripTile}
              onSelect={checkIsEntryStreamingVideo(entry) ? focusEntry : undefined}
            />
          ))}
        </div>
      </Scroll>
    </div>
  );
}
