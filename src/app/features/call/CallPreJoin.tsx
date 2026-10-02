import type { ComponentProps } from 'react';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useSetAtom } from 'jotai';
import type { Room } from 'matrix-js-sdk';
import type { LocalVideoTrack } from 'livekit-client';
import { Box, Header, Icon, Icons, Modal, ProgressBar, Text } from 'folds';
import classNames from 'classnames';
import { callPreJoinRoomIdAtom, isCallPaneCollapsedAtom } from '../../state/call';
import { settingsAtom } from '../../state/settings';
import { useSetting } from '../../state/hooks/settings';
import { useMatrixClient } from '../../hooks/useMatrixClient';
import { useRoomName } from '../../hooks/useRoomMeta';
import { useInterval } from '../../hooks/useInterval';
import { useMicrophoneInputLevel } from '../../hooks/call/useMicrophoneInputLevel';
import { useAudioTrackLevel } from '../../hooks/call/useAudioTrackLevel';
import type { ScreenshareTestTracks } from '../../hooks/call/useScreenshareTest';
import { useScreenshareTest } from '../../hooks/call/useScreenshareTest';
import { SCREENSHARE_SENDER_STATS_POLL_INTERVAL_MS } from '../../hooks/call/useScreenshareSenderStats';
import { isScreenshareSupported } from '../../plugins/call/localMedia';
import { formatScreenshareStreamLine } from '../../plugins/call/screenshare';
import { useCallActions } from './CallProvider';
import { CallControlButton } from './CallControlButton';
import { CallScreenQualityMenu } from './CallScreenQualityMenu';
import { CallPaneFrame } from './CallPaneFrame';
import * as css from './CallPane.css';
import * as screenCss from './CallScreen.css';

type ControlButtonSize = ComponentProps<typeof CallControlButton>['size'];
type ControlIconSize = ComponentProps<typeof CallControlButton>['iconSize'];

type LevelMeterProps = {
  label: string;
  level: number;
};
function LevelMeter({ label, level }: LevelMeterProps) {
  return (
    <Box direction="Column" gap="100">
      <Text size="T200" priority="300">
        {label}
      </Text>
      <ProgressBar variant="Success" size="300" min={0} max={1} value={level} radii="300" />
    </Box>
  );
}

type ScreenshareTestVideoProps = {
  videoTrack: LocalVideoTrack;
};
function ScreenshareTestVideo({ videoTrack }: ScreenshareTestVideoProps) {
  const videoElementRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const videoElement = videoElementRef.current;
    if (!videoElement) return undefined;
    videoTrack.attach(videoElement);
    return () => {
      videoTrack.detach(videoElement);
    };
  }, [videoTrack]);

  return (
    <video
      ref={videoElementRef}
      className={classNames(css.CallTileVideo, css.CallTileVideoContain)}
      autoPlay
      muted
      playsInline
    />
  );
}

type ScreenshareTestDetailsProps = {
  testTracks: ScreenshareTestTracks;
};
function ScreenshareTestDetails({ testTracks }: ScreenshareTestDetailsProps) {
  const { videoTrack, audioTrack } = testTracks;
  const [captureSettings, setCaptureSettings] = useState(() =>
    videoTrack.mediaStreamTrack.getSettings()
  );
  const streamAudioLevel = useAudioTrackLevel(audioTrack?.mediaStreamTrack);

  const pollCaptureSettings = useCallback(
    () => setCaptureSettings(videoTrack.mediaStreamTrack.getSettings()),
    [videoTrack]
  );
  useInterval(pollCaptureSettings, SCREENSHARE_SENDER_STATS_POLL_INTERVAL_MS);

  return (
    <Box direction="Column" gap="200">
      <Text size="T200" priority="300">
        Capturing{' '}
        {formatScreenshareStreamLine(
          captureSettings.width,
          captureSettings.height,
          captureSettings.frameRate
        )}
      </Text>
      {audioTrack ? (
        <LevelMeter label="Stream audio" level={streamAudioLevel} />
      ) : (
        <Text size="T200" priority="300">
          Stream audio not shared
        </Text>
      )}
    </Box>
  );
}

type CallPreJoinContentProps = {
  room: Room;
  controlsClassName: string;
  controlButtonSize?: ControlButtonSize;
  controlIconSize?: ControlIconSize;
};
function CallPreJoinContent({
  room,
  controlsClassName,
  controlButtonSize = '400',
  controlIconSize,
}: CallPreJoinContentProps) {
  const { startCall } = useCallActions();
  const setPreJoinRoomId = useSetAtom(callPreJoinRoomIdAtom);
  const setIsCallPaneCollapsed = useSetAtom(isCallPaneCollapsedAtom);
  const [preferredAudioInputDeviceId] = useSetting(settingsAtom, 'preferredAudioInputDeviceId');
  const [isTestingMicrophone, setIsTestingMicrophone] = useState(false);
  const { inputLevel, isMicrophoneAvailable } = useMicrophoneInputLevel(
    preferredAudioInputDeviceId,
    isTestingMicrophone
  );
  const { testTracks, isTesting: isTestingStream, startTest, stopTest } = useScreenshareTest();
  const isStreamTestSupported = isScreenshareSupported();

  const handleJoin = () => {
    setPreJoinRoomId(undefined);
    setIsCallPaneCollapsed(false);
    startCall(room);
  };

  const getStreamPlaceholderText = (): string =>
    isTestingStream ? 'Waiting for a screen…' : 'Test your stream to preview it here.';

  const getMicrophoneStatusText = (): string | undefined => {
    if (!isTestingMicrophone) return 'Test your microphone to see its input level.';
    if (!isMicrophoneAvailable) return 'Could not access the microphone.';
    return undefined;
  };
  const microphoneStatusText = getMicrophoneStatusText();

  return (
    <>
      <Box className={css.CallPreJoinStage}>
        {isStreamTestSupported && (
          <>
            <Box className={classNames(css.CallTile, css.CallPreJoinPreview)}>
              {testTracks ? (
                <ScreenshareTestVideo videoTrack={testTracks.videoTrack} />
              ) : (
                <Text size="T300" priority="300">
                  {getStreamPlaceholderText()}
                </Text>
              )}
            </Box>
            {testTracks && <ScreenshareTestDetails testTracks={testTracks} />}
          </>
        )}
        {microphoneStatusText ? (
          <Text size="T200" priority="300">
            {microphoneStatusText}
          </Text>
        ) : (
          <LevelMeter label="Microphone" level={inputLevel} />
        )}
      </Box>

      <Box className={controlsClassName} alignItems="Center" justifyContent="Center" gap="200">
        <CallControlButton
          size={controlButtonSize}
          iconSize={controlIconSize}
          radii="Pill"
          variant={isTestingMicrophone ? 'Success' : 'SurfaceVariant'}
          onClick={() => setIsTestingMicrophone((isTesting) => !isTesting)}
          label={isTestingMicrophone ? 'Stop Microphone Test' : 'Test Microphone'}
          icon={Icons.Mic}
          aria-pressed={isTestingMicrophone}
        />
        {isStreamTestSupported && (
          <>
            <CallControlButton
              size={controlButtonSize}
              iconSize={controlIconSize}
              radii="Pill"
              variant={isTestingStream ? 'Success' : 'SurfaceVariant'}
              onClick={isTestingStream ? stopTest : startTest}
              label={isTestingStream ? 'Stop Stream Test' : 'Test Stream'}
              icon={Icons.Monitor}
              aria-pressed={isTestingStream}
            />
            <CallScreenQualityMenu />
          </>
        )}
        <CallControlButton
          size={controlButtonSize}
          iconSize={controlIconSize}
          radii="Pill"
          variant="SurfaceVariant"
          onClick={() => setPreJoinRoomId(undefined)}
          label="Cancel"
          icon={Icons.Cross}
        />
        <CallControlButton
          size={controlButtonSize}
          iconSize={controlIconSize}
          radii="Pill"
          variant="Success"
          onClick={handleJoin}
          label="Join Call"
          icon={Icons.Phone}
          isIconFilled
        />
      </Box>
    </>
  );
}

type CallPreJoinRoomProps = {
  room: Room;
};

function CallPreJoinPaneContent({ room }: CallPreJoinRoomProps) {
  const roomName = useRoomName(room);
  const paneRef = useRef<HTMLDivElement>(null);

  return (
    <CallPaneFrame paneRef={paneRef} title={roomName} subtitle="Before you join">
      <CallPreJoinContent room={room} controlsClassName={css.CallPaneControls} />
    </CallPaneFrame>
  );
}

const PRE_JOIN_SCREEN_CONTROL_BUTTON_SIZE = '500';
const PRE_JOIN_SCREEN_CONTROL_ICON_SIZE = '200';

function CallPreJoinScreenContent({ room }: CallPreJoinRoomProps) {
  const roomName = useRoomName(room);

  return (
    <Modal className={screenCss.CallScreen}>
      <Header size="600" variant="Surface" className={css.CallPaneHeader}>
        <Icon size="100" src={Icons.Phone} filled />
        <Box grow="Yes" direction="Column">
          <Text size="T300" truncate>
            <b>{roomName}</b>
          </Text>
          <Text size="T200" priority="300">
            Before you join
          </Text>
        </Box>
      </Header>
      <CallPreJoinContent
        room={room}
        controlsClassName={screenCss.CallScreenControls}
        controlButtonSize={PRE_JOIN_SCREEN_CONTROL_BUTTON_SIZE}
        controlIconSize={PRE_JOIN_SCREEN_CONTROL_ICON_SIZE}
      />
    </Modal>
  );
}

type CallPreJoinProps = {
  roomId: string;
};

export function CallPreJoinPane({ roomId }: CallPreJoinProps) {
  const room = useMatrixClient().getRoom(roomId);
  if (!room) return null;
  return <CallPreJoinPaneContent room={room} />;
}

export function CallPreJoinScreen({ roomId }: CallPreJoinProps) {
  const room = useMatrixClient().getRoom(roomId);
  if (!room) return null;
  return <CallPreJoinScreenContent room={room} />;
}
