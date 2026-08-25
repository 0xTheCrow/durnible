import React from 'react';
import { useAtomValue, useSetAtom } from 'jotai';
import { Box, Icon, Icons, Spinner, Text } from 'folds';
import { callStateAtom, isCallPaneCollapsedAtom } from '../../state/call';
import type { CallConnection } from '../../plugins/call/CallConnection';
import { useCallActions } from './CallProvider';
import { CallControlButton } from './CallControlButton';
import { useLocalMediaControls } from '../../hooks/call/useLocalMediaControls';
import { useCallDeafen } from '../../hooks/call/useCallDeafen';
import { useRoomNavigate } from '../../hooks/useRoomNavigate';
import { ScreenSize, useScreenSizeContext } from '../../hooks/useScreenSize';
import { useRoomName } from '../../hooks/useRoomMeta';
import * as css from './CallStrip.css';

type ConnectedCallBarProps = {
  connection: CallConnection;
  isReconnecting: boolean;
};
function ConnectedCallBar({ connection, isReconnecting }: ConnectedCallBarProps) {
  const { endCall } = useCallActions();
  const { navigateRoom } = useRoomNavigate();
  const screenSize = useScreenSizeContext();
  const isMobile = screenSize === ScreenSize.Mobile;
  const setIsCallPaneCollapsed = useSetAtom(isCallPaneCollapsedAtom);
  const { isMicrophoneEnabled, toggleMicrophone } = useLocalMediaControls(connection.livekitRoom);
  const { isDeafened, toggleDeafen } = useCallDeafen(connection.livekitRoom);
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
          aria-label={isMobile ? `Expand ${roomName} Call` : undefined}
          onClick={
            isMobile
              ? () => setIsCallPaneCollapsed(false)
              : () => navigateRoom(connection.matrixRoom.roomId)
          }
        >
          <b>{roomName}</b>
        </Text>
        <Text size="T200" priority="300">
          {isReconnecting ? 'Reconnecting…' : 'Voice call'}
        </Text>
      </Box>
      <CallControlButton
        size="300"
        radii="300"
        onClick={() => setIsCallPaneCollapsed(false)}
        label="Expand Call"
        icon={Icons.ChevronRight}
      />
      <CallControlButton
        size="300"
        radii="300"
        onClick={() => toggleMicrophone()}
        label={isMicrophoneEnabled ? 'Mute Microphone' : 'Unmute Microphone'}
        icon={isMicrophoneEnabled ? Icons.Mic : Icons.MicMute}
        aria-pressed={!isMicrophoneEnabled}
      />
      <CallControlButton
        size="300"
        radii="300"
        onClick={() => toggleDeafen()}
        label={isDeafened ? 'Undeafen' : 'Deafen'}
        icon={Icons.Headphone}
        isIconFilled={isDeafened}
        aria-pressed={isDeafened}
      />
      <CallControlButton
        size="300"
        radii="300"
        variant="Critical"
        onClick={() => endCall()}
        label="Leave Call"
        icon={Icons.Phone}
        isIconFilled
      />
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
