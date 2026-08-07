import React, { useRef, useState } from 'react';
import { useAtomValue, useSetAtom } from 'jotai';
import { Box, Icon, IconButton, Icons, Scroll, Text } from 'folds';
import { Track } from 'livekit-client';
import classNames from 'classnames';
import { callStateAtom, isCallPaneCollapsedAtom } from '../../state/call';
import type { CallConnection } from '../../plugins/call/CallConnection';
import { isScreenshareSupported } from '../../plugins/call/localMedia';
import type { CallVideoSource } from '../../hooks/call/useCallVideoSources';
import { useCallVideoSources } from '../../hooks/call/useCallVideoSources';
import { useActiveSpeakers } from '../../hooks/call/useActiveSpeakers';
import { useLocalMediaControls } from '../../hooks/call/useLocalMediaControls';
import { useCallMemberships } from '../../hooks/useCallMemberships';
import { checkIsFullscreenSupported, useFullscreen } from '../../hooks/useFullscreen';
import { useRoomName } from '../../hooks/useRoomMeta';
import { ScreenSize, useScreenSizeContext } from '../../hooks/useScreenSize';
import { findCallParticipantUserId } from '../../utils/call';
import { useCallActions } from './CallProvider';
import { CallParticipantTile } from './CallParticipantTile';
import * as css from './CallPane.css';

type ConnectedCallPaneProps = {
  connection: CallConnection;
  isReconnecting: boolean;
};
function ConnectedCallPane({ connection, isReconnecting }: ConnectedCallPaneProps) {
  const { livekitRoom, matrixRoom } = connection;
  const screenSize = useScreenSizeContext();
  const { endCall } = useCallActions();
  const setIsCollapsed = useSetAtom(isCallPaneCollapsedAtom);
  const videoSources = useCallVideoSources(livekitRoom);
  const activeSpeakers = useActiveSpeakers(livekitRoom);
  const memberships = useCallMemberships(matrixRoom);
  const roomName = useRoomName(matrixRoom);
  const paneRef = useRef<HTMLDivElement>(null);
  const { isFullscreen, toggleFullscreen } = useFullscreen(paneRef);
  const [spotlightKey, setSpotlightKey] = useState<string>();
  const {
    isMicrophoneEnabled,
    isCameraEnabled,
    isScreenshareEnabled,
    toggleMicrophone,
    toggleCamera,
    toggleScreenshare,
  } = useLocalMediaControls(livekitRoom);

  const speakingIdentities = new Set(activeSpeakers.map((speaker) => speaker.identity));

  const remoteScreenshareSources = videoSources.filter(
    (videoSource) =>
      videoSource.source === Track.Source.ScreenShare && !videoSource.participant.isLocal
  );
  const spotlightSource =
    videoSources.find((videoSource) => videoSource.key === spotlightKey) ??
    remoteScreenshareSources[remoteScreenshareSources.length - 1];
  const stripSources = spotlightSource
    ? videoSources.filter((videoSource) => videoSource.key !== spotlightSource.key)
    : [];

  const renderTile = (videoSource: CallVideoSource, className: string, onSelect?: () => void) => (
    <CallParticipantTile
      key={videoSource.key}
      room={matrixRoom}
      participant={videoSource.participant}
      source={videoSource.source}
      userId={findCallParticipantUserId(videoSource.participant.identity, memberships)}
      isSpeaking={speakingIdentities.has(videoSource.participant.identity)}
      className={className}
      onSelect={onSelect}
    />
  );

  return (
    <Box
      ref={paneRef}
      direction="Column"
      shrink="No"
      className={classNames(css.CallPane, screenSize === ScreenSize.Mobile && css.CallPaneStacked)}
    >
      <Box className={css.CallPaneHeader} alignItems="Center" gap="200" shrink="No">
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
        <IconButton
          size="300"
          radii="300"
          onClick={() => setIsCollapsed(true)}
          aria-label="Collapse Call"
        >
          <Icon size="100" src={Icons.ChevronLeft} />
        </IconButton>
      </Box>

      {spotlightSource ? (
        <Box direction="Column" grow="Yes" className={css.CallSpotlightLayout}>
          <div className={css.CallSpotlight}>
            {renderTile(spotlightSource, css.CallSpotlightTile)}
          </div>
          {stripSources.length > 0 && (
            <Scroll
              className={css.CallTileStripScroll}
              direction="Horizontal"
              size="300"
              hideTrack
              visibility="Hover"
            >
              <div className={css.CallTileStrip}>
                {stripSources.map((videoSource) =>
                  renderTile(videoSource, css.CallStripTile, () => setSpotlightKey(videoSource.key))
                )}
              </div>
            </Scroll>
          )}
        </Box>
      ) : (
        <Box grow="Yes">
          <Scroll size="300" hideTrack visibility="Hover">
            <div className={css.CallTileGrid}>
              {videoSources.map((videoSource) => renderTile(videoSource, css.CallGridTile))}
            </div>
          </Scroll>
        </Box>
      )}

      <Box className={css.CallPaneControls} alignItems="Center" justifyContent="Center" gap="200">
        <IconButton
          size="400"
          radii="Pill"
          variant={isMicrophoneEnabled ? 'SurfaceVariant' : 'Critical'}
          onClick={() => toggleMicrophone()}
          aria-label={isMicrophoneEnabled ? 'Mute Microphone' : 'Unmute Microphone'}
          aria-pressed={!isMicrophoneEnabled}
        >
          <Icon size="100" src={isMicrophoneEnabled ? Icons.Mic : Icons.MicMute} />
        </IconButton>
        <IconButton
          size="400"
          radii="Pill"
          variant={isCameraEnabled ? 'Success' : 'SurfaceVariant'}
          onClick={() => toggleCamera()}
          aria-label={isCameraEnabled ? 'Turn Off Camera' : 'Turn On Camera'}
          aria-pressed={isCameraEnabled}
        >
          <Icon size="100" src={isCameraEnabled ? Icons.VideoCamera : Icons.VideoCameraMute} />
        </IconButton>
        {isScreenshareSupported() && (
          <IconButton
            size="400"
            radii="Pill"
            variant={isScreenshareEnabled ? 'Success' : 'SurfaceVariant'}
            onClick={() => toggleScreenshare()}
            aria-label={isScreenshareEnabled ? 'Stop Sharing Screen' : 'Share Screen'}
            aria-pressed={isScreenshareEnabled}
          >
            <Icon size="100" src={Icons.Monitor} />
          </IconButton>
        )}
        {checkIsFullscreenSupported() && (
          <IconButton
            size="400"
            radii="Pill"
            variant={isFullscreen ? 'Success' : 'SurfaceVariant'}
            onClick={toggleFullscreen}
            aria-label={isFullscreen ? 'Exit Fullscreen' : 'Enter Fullscreen'}
            aria-pressed={isFullscreen}
          >
            <Icon size="100" src={Icons.External} />
          </IconButton>
        )}
        <IconButton
          size="400"
          radii="Pill"
          variant="Critical"
          onClick={() => endCall()}
          aria-label="Leave Call"
        >
          <Icon size="100" src={Icons.Phone} filled />
        </IconButton>
      </Box>
    </Box>
  );
}

export function CallPane() {
  const callState = useAtomValue(callStateAtom);
  const isCollapsed = useAtomValue(isCallPaneCollapsedAtom);

  if (isCollapsed) return null;
  if (callState.status !== 'connected' && callState.status !== 'reconnecting') return null;

  return (
    <ConnectedCallPane
      connection={callState.connection}
      isReconnecting={callState.status === 'reconnecting'}
    />
  );
}
