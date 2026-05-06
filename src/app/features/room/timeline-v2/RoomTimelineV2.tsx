import type { RefObject } from 'react';
import React from 'react';
import type { Room } from 'matrix-js-sdk';
import { Box, Text } from 'folds';
import type { EditorController } from '../../../components/editor';

type RoomTimelineV2Props = {
  room: Room;
  eventId?: string;
  roomInputRef: RefObject<HTMLElement>;
  editorInputRef: RefObject<EditorController | null>;
};

// In-progress rewrite. Built up one behavior at a time so each piece is
// understood in isolation. Toggled via the "Use new timeline (V2)" setting
// on the General settings page; remove this file and the toggle once V2
// replaces RoomTimeline.tsx.
export function RoomTimelineV2({
  room,
  eventId: _eventId,
  roomInputRef: _roomInputRef,
  editorInputRef: _editorInputRef,
}: RoomTimelineV2Props) {
  return (
    <Box grow="Yes" direction="Column" alignItems="Center" justifyContent="Center">
      <Text size="H4">RoomTimelineV2 stub</Text>
      <Text size="T300">{room.roomId}</Text>
    </Box>
  );
}
