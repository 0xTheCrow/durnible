import React from 'react';
import { useAtomValue } from 'jotai';
import type { Room } from 'matrix-js-sdk';
import { Box, Button, Icon, Icons, Spinner, Text } from 'folds';
import { callStateAtom } from '../../state/call';
import { useActiveCallParticipantIds } from '../../hooks/call/useActiveCallParticipantIds';
import { useCallActions } from './CallProvider';
import * as css from './CallStrip.css';

type RoomCallBannerProps = {
  room: Room;
};
export function RoomCallBanner({ room }: RoomCallBannerProps) {
  const participantIds = useActiveCallParticipantIds(room);
  const callState = useAtomValue(callStateAtom);
  const { startCall, endCall } = useCallActions();

  const isCallFailedForRoom = callState.status === 'failed' && callState.roomId === room.roomId;
  const isJoiningRoomCall = callState.status === 'connecting' && callState.roomId === room.roomId;
  const isConnectedToRoomCall =
    (callState.status === 'connected' || callState.status === 'reconnecting') &&
    callState.roomId === room.roomId;

  if (isCallFailedForRoom) {
    return (
      <Box className={css.CallStrip} alignItems="Center" gap="200" shrink="No">
        <Icon size="100" src={Icons.Warning} />
        <Box grow="Yes">
          <Text size="T300" truncate>
            Call failed: {callState.error.message}
          </Text>
        </Box>
        <Button size="300" variant="Secondary" fill="Soft" radii="300" onClick={() => endCall()}>
          <Text size="B300">Dismiss</Text>
        </Button>
      </Box>
    );
  }

  if (isJoiningRoomCall) {
    return (
      <Box className={css.CallStrip} alignItems="Center" gap="200" shrink="No">
        <Spinner size="100" variant="Secondary" />
        <Text size="T300">Joining voice call…</Text>
      </Box>
    );
  }

  if (isConnectedToRoomCall || participantIds.length === 0) return null;

  return (
    <Box className={css.CallStrip} alignItems="Center" gap="200" shrink="No">
      <Icon size="100" src={Icons.Phone} />
      <Box grow="Yes">
        <Text size="T300" truncate>
          Voice call in progress · {participantIds.length} joined
        </Text>
      </Box>
      <Button size="300" variant="Success" radii="300" onClick={() => startCall(room)}>
        <Text size="B300">Join</Text>
      </Button>
    </Box>
  );
}
