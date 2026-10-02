import React, { useRef } from 'react';
import { useAtomValue, useSetAtom } from 'jotai';
import { Box, Icons } from 'folds';
import { callPreJoinRoomIdAtom, callStateAtom, isCallPaneCollapsedAtom } from '../../state/call';
import { settingsAtom } from '../../state/settings';
import { useSetting } from '../../state/hooks/settings';
import type { CallConnection } from '../../plugins/call/CallConnection';
import { isScreenshareSupported } from '../../plugins/call/localMedia';
import { useCallParticipantEntries } from '../../hooks/call/useCallParticipantEntries';
import { useLocalMediaControls } from '../../hooks/call/useLocalMediaControls';
import { useCallDeafen } from '../../hooks/call/useCallDeafen';
import { useCallMemberships } from '../../hooks/useCallMemberships';
import { checkIsFullscreenSupported, useFullscreen } from '../../hooks/useFullscreen';
import { useRoomName } from '../../hooks/useRoomMeta';
import { useCallActions } from './CallProvider';
import { CallStage } from './CallStage';
import { CallControlButton } from './CallControlButton';
import { CallMasterVolumeMenu } from './CallMasterVolumeMenu';
import { CallEncryptionDebugPanel } from './CallEncryptionDebugPanel';
import { CallPaneFrame } from './CallPaneFrame';
import { CallPreJoinPane } from './CallPreJoin';
import * as css from './CallPane.css';

type ConnectedCallPaneProps = {
  connection: CallConnection;
  isReconnecting: boolean;
};
function ConnectedCallPane({ connection, isReconnecting }: ConnectedCallPaneProps) {
  const { livekitRoom, matrixRoom } = connection;
  const { endCall } = useCallActions();
  const setIsCollapsed = useSetAtom(isCallPaneCollapsedAtom);
  const entries = useCallParticipantEntries(livekitRoom);
  const memberships = useCallMemberships(matrixRoom);
  const roomName = useRoomName(matrixRoom);
  const paneRef = useRef<HTMLDivElement>(null);
  const { isFullscreen, toggleFullscreen } = useFullscreen(paneRef);
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

  return (
    <CallPaneFrame
      paneRef={paneRef}
      title={roomName}
      subtitle={isReconnecting ? 'Reconnecting…' : undefined}
      isFullscreen={isFullscreen}
      headerActions={
        <CallControlButton
          size="300"
          radii="300"
          onClick={() => setIsCollapsed(true)}
          label="Collapse Call"
          icon={Icons.ChevronLeft}
          data-testid="call-collapse"
        />
      }
    >
      {developerTools && <CallEncryptionDebugPanel livekitRoom={livekitRoom} />}

      <CallStage room={matrixRoom} entries={entries} memberships={memberships} />

      <Box className={css.CallPaneControls} alignItems="Center" justifyContent="Center" gap="200">
        <CallControlButton
          size="400"
          radii="Pill"
          variant={isMicrophoneEnabled ? 'SurfaceVariant' : 'Critical'}
          onClick={() => toggleMicrophone()}
          label={isMicrophoneEnabled ? 'Mute Microphone' : 'Unmute Microphone'}
          icon={isMicrophoneEnabled ? Icons.Mic : Icons.MicMute}
          aria-pressed={!isMicrophoneEnabled}
          data-testid="call-microphone-toggle"
        />
        <CallControlButton
          size="400"
          radii="Pill"
          variant={isDeafened ? 'Critical' : 'SurfaceVariant'}
          onClick={() => toggleDeafen()}
          label={isDeafened ? 'Undeafen' : 'Deafen'}
          icon={Icons.Headphone}
          isIconFilled={isDeafened}
          aria-pressed={isDeafened}
          data-testid="call-deafen-toggle"
        />
        <CallMasterVolumeMenu room={matrixRoom} entries={entries} memberships={memberships} />
        <CallControlButton
          size="400"
          radii="Pill"
          variant={isCameraEnabled ? 'Success' : 'SurfaceVariant'}
          onClick={() => toggleCamera()}
          label={isCameraEnabled ? 'Turn Off Camera' : 'Turn On Camera'}
          icon={isCameraEnabled ? Icons.VideoCamera : Icons.VideoCameraMute}
          aria-pressed={isCameraEnabled}
          data-testid="call-camera-toggle"
        />
        {isScreenshareSupported() && (
          <CallControlButton
            size="400"
            radii="Pill"
            variant={isScreenshareEnabled ? 'Success' : 'SurfaceVariant'}
            onClick={() => toggleScreenshare()}
            label={isScreenshareEnabled ? 'Stop Sharing Screen' : 'Share Screen'}
            icon={Icons.Monitor}
            aria-pressed={isScreenshareEnabled}
            data-testid="call-screenshare-toggle"
          />
        )}
        {checkIsFullscreenSupported() && (
          <CallControlButton
            size="400"
            radii="Pill"
            variant={isFullscreen ? 'Success' : 'SurfaceVariant'}
            onClick={toggleFullscreen}
            label={isFullscreen ? 'Exit Fullscreen' : 'Enter Fullscreen'}
            icon={Icons.External}
            aria-pressed={isFullscreen}
          />
        )}
        <CallControlButton
          size="400"
          radii="Pill"
          variant="Critical"
          onClick={() => endCall()}
          label="Leave Call"
          icon={Icons.Phone}
          isIconFilled
          data-testid="call-leave"
        />
      </Box>
    </CallPaneFrame>
  );
}

export function CallPane() {
  const callState = useAtomValue(callStateAtom);
  const isCollapsed = useAtomValue(isCallPaneCollapsedAtom);
  const preJoinRoomId = useAtomValue(callPreJoinRoomIdAtom);

  if (preJoinRoomId) return <CallPreJoinPane roomId={preJoinRoomId} />;
  if (isCollapsed) return null;
  if (callState.status !== 'connected' && callState.status !== 'reconnecting') return null;

  return (
    <ConnectedCallPane
      connection={callState.connection}
      isReconnecting={callState.status === 'reconnecting'}
    />
  );
}
