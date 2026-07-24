import React from 'react';
import { useAtomValue, useSetAtom } from 'jotai';
import { Box, Icon, IconButton, Icons, Spinner, Text } from 'folds';
import { callStateAtom, isCallPaneCollapsedAtom } from '../../state/call';
import type { CallConnection } from '../../plugins/call/CallConnection';
import { useCallActions } from './CallProvider';
import { useLocalMediaControls } from '../../hooks/call/useLocalMediaControls';
import { useRoomNavigate } from '../../hooks/useRoomNavigate';
import { useRoomName } from '../../hooks/useRoomMeta';
import * as css from './CallStrip.css';

type ConnectedCallBarProps = {
  connection: CallConnection;
  isReconnecting: boolean;
};
function ConnectedCallBar({ connection, isReconnecting }: ConnectedCallBarProps) {
  const { endCall } = useCallActions();
  const { navigateRoom } = useRoomNavigate();
  const setIsCallPaneCollapsed = useSetAtom(isCallPaneCollapsedAtom);
  const { isMicrophoneEnabled, toggleMicrophone } = useLocalMediaControls(connection.livekitRoom);
  const roomName = useRoomName(connection.matrixRoom);

  return (
    <Box className={css.CallStrip} alignItems="Center" gap="200" shrink="No">
      {isReconnecting ? (
        <Spinner size="100" variant="Secondary" />
      ) : (
        <Icon size="100" src={Icons.Phone} filled />
      )}
      <Box grow="Yes" alignItems="Baseline" gap="200">
        <Text
          className={css.CallStripRoomName}
          as="button"
          type="button"
          size="T300"
          truncate
          onClick={() => navigateRoom(connection.matrixRoom.roomId)}
        >
          <b>{roomName}</b>
        </Text>
        <Text size="T200" priority="300">
          {isReconnecting ? 'Reconnecting…' : 'Voice call'}
        </Text>
      </Box>
      <IconButton
        size="300"
        radii="300"
        onClick={() => setIsCallPaneCollapsed(false)}
        aria-label="Expand Call"
      >
        <Icon size="100" src={Icons.ChevronRight} />
      </IconButton>
      <IconButton
        size="300"
        radii="300"
        onClick={() => toggleMicrophone()}
        aria-label={isMicrophoneEnabled ? 'Mute Microphone' : 'Unmute Microphone'}
        aria-pressed={!isMicrophoneEnabled}
      >
        <Icon size="100" src={isMicrophoneEnabled ? Icons.Mic : Icons.MicMute} />
      </IconButton>
      <IconButton
        size="300"
        radii="300"
        variant="Critical"
        onClick={() => endCall()}
        aria-label="Leave Call"
      >
        <Icon size="100" src={Icons.Phone} filled />
      </IconButton>
    </Box>
  );
}

export function CallBar() {
  const callState = useAtomValue(callStateAtom);
  const isCallPaneCollapsed = useAtomValue(isCallPaneCollapsedAtom);

  if (!isCallPaneCollapsed) return null;
  if (callState.status !== 'connected' && callState.status !== 'reconnecting') return null;
  return (
    <ConnectedCallBar
      connection={callState.connection}
      isReconnecting={callState.status === 'reconnecting'}
    />
  );
}
