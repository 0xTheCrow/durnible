import React from 'react';
import { useAtomValue } from 'jotai';
import type { Room } from 'matrix-js-sdk';
import { Box, Text } from 'folds';
import { useCallMemberships } from '../../hooks/useCallMemberships';
import { callStateAtom } from '../../state/call';

type CallViewProps = {
  room: Room;
};
export function CallView({ room }: CallViewProps) {
  const memberships = useCallMemberships(room);
  const callState = useAtomValue(callStateAtom);
  const isConnectedToThisCall =
    (callState.status === 'connected' || callState.status === 'reconnecting') &&
    callState.roomId === room.roomId;

  return (
    <Box direction="Column" gap="200">
      <Text size="L400">{isConnectedToThisCall ? 'Connected' : 'Not connected'}</Text>
      {memberships.map((membership) => (
        <Text key={membership.memberId} size="T300">
          {membership.userId}
        </Text>
      ))}
    </Box>
  );
}
