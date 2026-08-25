import type { TouchEvent as ReactTouchEvent } from 'react';
import React from 'react';
import { useAtomValue, useSetAtom } from 'jotai';
import { Box, Header, Icon, Icons, Modal, Text } from 'folds';
import { callStateAtom, isCallPaneCollapsedAtom } from '../../state/call';
import { settingsAtom } from '../../state/settings';
import { useSetting } from '../../state/hooks/settings';
import type { CallConnection } from '../../plugins/call/CallConnection';
import { isScreenshareSupported } from '../../plugins/call/localMedia';
import {
  checkIsEntryStreamingVideo,
  useCallParticipantEntries,
} from '../../hooks/call/useCallParticipantEntries';
import { useLocalMediaControls } from '../../hooks/call/useLocalMediaControls';
import { useCallDeafen } from '../../hooks/call/useCallDeafen';
import { useCallMemberships } from '../../hooks/useCallMemberships';
import { ScreenSize, useScreenSizeContext } from '../../hooks/useScreenSize';
import { useRoomName } from '../../hooks/useRoomMeta';
import { CALL_TILE_PORTRAIT_ASPECT_RATIO } from '../../utils/call';
import { useSwipeDownDismiss } from '../../hooks/useSwipeDownDismiss';
import { useScreenWakeLock } from '../../hooks/useScreenWakeLock';
import { OverlayModal } from '../../components/OverlayModal';
import { useCallActions } from './CallProvider';
import { CallStage } from './CallStage';
import { CallControlButton } from './CallControlButton';
import { CallMasterVolumeMenu } from './CallMasterVolumeMenu';
import { CallEncryptionDebugPanel } from './CallEncryptionDebugPanel';
import * as paneCss from './CallPane.css';
import * as css from './CallScreen.css';

const CONTROL_BUTTON_SIZE = '500';
const CONTROL_ICON_SIZE = '200';
const HEADER_BUTTON_SIZE = '400';

type ConnectedCallScreenProps = {
  connection: CallConnection;
  isReconnecting: boolean;
  onMinimize: () => void;
};
function ConnectedCallScreen({ connection, isReconnecting, onMinimize }: ConnectedCallScreenProps) {
  const { livekitRoom, matrixRoom } = connection;
  const { endCall } = useCallActions();
  const entries = useCallParticipantEntries(livekitRoom);
  const memberships = useCallMemberships(matrixRoom);
  const roomName = useRoomName(matrixRoom);
  const {
    isMicrophoneEnabled,
    isCameraEnabled,
    isScreenshareEnabled,
    toggleMicrophone,
    toggleCamera,
    toggleScreenshare,
  } = useLocalMediaControls(livekitRoom);
  const { isDeafened, toggleDeafen } = useCallDeafen(livekitRoom);
  const [developerTools] = useSetting(settingsAtom, 'developerTools');
  const [swipeGestures] = useSetting(settingsAtom, 'swipeGestures');
  const { dragOffset, onTouchStart, onTouchMove, onTouchEnd } = useSwipeDownDismiss(
    onMinimize,
    swipeGestures
  );
  const isDragging = dragOffset !== undefined;

  useScreenWakeLock(entries.some(checkIsEntryStreamingVideo));

  return (
    <Modal
      className={css.CallScreen}
      style={{
        transform: isDragging ? `translateY(${dragOffset}px)` : undefined,
        transition: isDragging ? 'none' : undefined,
      }}
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
      onTouchCancel={onTouchEnd}
    >
      <Header size="600" variant="Surface" className={paneCss.CallPaneHeader}>
        <Icon size="100" src={Icons.Phone} filled />
        <Box grow="Yes" direction="Column">
          <Text size="T300" truncate>
            <b>{roomName}</b>
          </Text>
          {isReconnecting && (
            <Text size="T200" priority="300">
              Reconnecting…
            </Text>
          )}
        </Box>
        <CallControlButton
          size={HEADER_BUTTON_SIZE}
          iconSize={CONTROL_ICON_SIZE}
          radii="300"
          onClick={onMinimize}
          label="Minimize Call"
          icon={Icons.ChevronBottom}
        />
      </Header>

      {developerTools && <CallEncryptionDebugPanel livekitRoom={livekitRoom} />}

      <CallStage
        room={matrixRoom}
        entries={entries}
        memberships={memberships}
        tileAspectRatio={CALL_TILE_PORTRAIT_ASPECT_RATIO}
      />

      <Box
        className={css.CallScreenControls}
        alignItems="Center"
        justifyContent="Center"
        gap="200"
        onTouchStart={(event: ReactTouchEvent) => event.stopPropagation()}
      >
        <CallControlButton
          size={CONTROL_BUTTON_SIZE}
          iconSize={CONTROL_ICON_SIZE}
          radii="Pill"
          variant={isMicrophoneEnabled ? 'SurfaceVariant' : 'Critical'}
          onClick={() => toggleMicrophone()}
          label={isMicrophoneEnabled ? 'Mute Microphone' : 'Unmute Microphone'}
          icon={isMicrophoneEnabled ? Icons.Mic : Icons.MicMute}
          aria-pressed={!isMicrophoneEnabled}
        />
        <CallControlButton
          size={CONTROL_BUTTON_SIZE}
          iconSize={CONTROL_ICON_SIZE}
          radii="Pill"
          variant={isCameraEnabled ? 'Success' : 'SurfaceVariant'}
          onClick={() => toggleCamera()}
          label={isCameraEnabled ? 'Turn Off Camera' : 'Turn On Camera'}
          icon={isCameraEnabled ? Icons.VideoCamera : Icons.VideoCameraMute}
          aria-pressed={isCameraEnabled}
        />
        <CallControlButton
          size={CONTROL_BUTTON_SIZE}
          iconSize={CONTROL_ICON_SIZE}
          radii="Pill"
          variant={isDeafened ? 'Critical' : 'SurfaceVariant'}
          onClick={() => toggleDeafen()}
          label={isDeafened ? 'Undeafen' : 'Deafen'}
          icon={Icons.Headphone}
          isIconFilled={isDeafened}
          aria-pressed={isDeafened}
        />
        <CallMasterVolumeMenu
          room={matrixRoom}
          entries={entries}
          memberships={memberships}
          size={CONTROL_BUTTON_SIZE}
          iconSize={CONTROL_ICON_SIZE}
        />
        {isScreenshareSupported() && (
          <CallControlButton
            size={CONTROL_BUTTON_SIZE}
            iconSize={CONTROL_ICON_SIZE}
            radii="Pill"
            variant={isScreenshareEnabled ? 'Success' : 'SurfaceVariant'}
            onClick={() => toggleScreenshare()}
            label={isScreenshareEnabled ? 'Stop Sharing Screen' : 'Share Screen'}
            icon={Icons.Monitor}
            aria-pressed={isScreenshareEnabled}
          />
        )}
        <CallControlButton
          size={CONTROL_BUTTON_SIZE}
          iconSize={CONTROL_ICON_SIZE}
          radii="Pill"
          variant="Critical"
          onClick={() => endCall()}
          label="Leave Call"
          icon={Icons.Phone}
          isIconFilled
        />
      </Box>
    </Modal>
  );
}

export function CallScreen() {
  const screenSize = useScreenSizeContext();
  const callState = useAtomValue(callStateAtom);
  const isCollapsed = useAtomValue(isCallPaneCollapsedAtom);
  const setIsCollapsed = useSetAtom(isCallPaneCollapsedAtom);

  const connection =
    callState.status === 'connected' || callState.status === 'reconnecting'
      ? callState.connection
      : undefined;
  const isOpen = screenSize === ScreenSize.Mobile && connection !== undefined && !isCollapsed;

  return (
    <OverlayModal
      open={isOpen}
      onClose={() => setIsCollapsed(true)}
      backdrop={false}
      focusTrapOptions={{ clickOutsideDeactivates: false }}
    >
      {isOpen && connection && (
        <ConnectedCallScreen
          connection={connection}
          isReconnecting={callState.status === 'reconnecting'}
          onMinimize={() => setIsCollapsed(true)}
        />
      )}
    </OverlayModal>
  );
}
