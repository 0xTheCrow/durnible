import React, { useEffect, useRef, useState } from 'react';
import type { Room } from 'matrix-js-sdk';
import type { CallMembership } from 'matrix-js-sdk/lib/matrixrtc';
import type { Participant } from 'livekit-client';
import { Track } from 'livekit-client';
import { Box, Icon, Icons, Spinner, Text } from 'folds';
import classNames from 'classnames';
import { useAtom, useAtomValue } from 'jotai';
import { callPopOutAtom, isCallDeafenedAtom } from '../../state/call';
import {
  checkCanOpenPopOutWindow,
  getPopOutWindowSize,
  openPopOutWindow,
} from '../../plugins/call/popOutWindow';
import type { CallVideoSourceKind } from '../../hooks/call/useCallParticipantEntries';
import { checkIsScreenshareAudioEnabled } from '../../hooks/call/useCallParticipantEntries';
import { useParticipantTrackPublications } from '../../hooks/call/useParticipantTrackPublications';
import { useIsParticipantSpeaking } from '../../hooks/call/useIsParticipantSpeaking';
import { useCallUserIsMuted } from '../../state/hooks/callVolumePreferences';
import { resolveCallParticipant } from '../../utils/call';
import { checkIsFirefox } from '../../utils/user-agent';
import { CallMemberAvatar } from './CallMemberAvatar';
import { useCallUserVolumeMenu } from './useCallUserVolumeMenu';
import * as css from './CallPane.css';

type CallParticipantTileProps = {
  room: Room;
  participant: Participant;
  source: CallVideoSourceKind;
  memberships: CallMembership[];
  isScreensharing?: boolean;
  isFocused?: boolean;
  className: string;
  onSelect?: (participantIdentity: string) => void;
};
function CallParticipantTileComponent({
  room,
  participant,
  source,
  memberships,
  isScreensharing,
  isFocused,
  className,
  onSelect,
}: CallParticipantTileProps) {
  const trackPublications = useParticipantTrackPublications(participant);
  const isSpeaking = useIsParticipantSpeaking(participant);
  const isDeafened = useAtomValue(isCallDeafenedAtom);
  const videoRef = useRef<HTMLVideoElement>(null);
  const isDeafenedLocally = participant.isLocal && isDeafened;

  const isScreenshareSource = source === Track.Source.ScreenShare;
  const videoPublication = trackPublications.find((publication) => publication.source === source);
  const microphonePublication = trackPublications.find(
    (publication) => publication.source === Track.Source.Microphone
  );
  const videoTrack = videoPublication?.isMuted ? undefined : videoPublication?.track;
  const isMuted = microphonePublication === undefined || microphonePublication.isMuted;
  const isScreenshareAudioEnabled = checkIsScreenshareAudioEnabled(participant);

  useEffect(() => {
    const videoElement = videoRef.current;
    if (!videoElement || !videoTrack) return undefined;
    videoTrack.attach(videoElement);
    return () => {
      videoTrack.detach(videoElement);
    };
  }, [videoTrack]);

  const [isInPictureInPicture, setIsInPictureInPicture] = useState(false);
  const isVideoRendered = videoTrack !== undefined;

  useEffect(() => {
    const videoElement = videoRef.current;
    if (!videoElement) return undefined;
    const handleEnterPictureInPicture = () => setIsInPictureInPicture(true);
    const handleLeavePictureInPicture = () => setIsInPictureInPicture(false);
    videoElement.addEventListener('enterpictureinpicture', handleEnterPictureInPicture);
    videoElement.addEventListener('leavepictureinpicture', handleLeavePictureInPicture);
    return () => {
      videoElement.removeEventListener('enterpictureinpicture', handleEnterPictureInPicture);
      videoElement.removeEventListener('leavepictureinpicture', handleLeavePictureInPicture);
      setIsInPictureInPicture(false);
      if (document.pictureInPictureElement === videoElement) document.exitPictureInPicture();
    };
  }, [isVideoRendered]);

  const { userId, displayName } = resolveCallParticipant(room, participant.identity, memberships);

  const [callPopOut, setCallPopOut] = useAtom(callPopOutAtom);
  const isInPopOutWindow = callPopOut?.participant === participant && callPopOut.source === source;
  const isPoppedOut = isInPopOutWindow || isInPictureInPicture;
  const isPopOutAvailable =
    isVideoRendered &&
    !checkIsFirefox() &&
    (checkCanOpenPopOutWindow() || document.pictureInPictureEnabled === true);

  const togglePopOut = () => {
    if (isInPopOutWindow) {
      setCallPopOut(undefined);
      return;
    }
    if (isInPictureInPicture) {
      document.exitPictureInPicture();
      return;
    }
    const videoElement = videoRef.current;
    if (!videoElement) return;
    if (!checkCanOpenPopOutWindow()) {
      videoElement.requestPictureInPicture();
      return;
    }
    openPopOutWindow(getPopOutWindowSize(videoElement)).then((popOutWindow) => {
      if (popOutWindow) setCallPopOut({ participant, source, displayName, popOutWindow });
    });
  };

  const isMutedLocally = useCallUserIsMuted(userId);
  const { volumeMenuTriggerProps, volumeMenu } = useCallUserVolumeMenu(
    userId,
    displayName,
    isScreenshareAudioEnabled
  );

  const renderPlaceholder = () => {
    if (isScreenshareSource) {
      return (
        <Box direction="Column" alignItems="Center" gap="200">
          <Spinner size="400" variant="Secondary" />
          <Text align="Center" size="T200" priority="300">
            Waiting for {displayName}…
          </Text>
        </Box>
      );
    }
    if (!userId) return <Icon size="400" src={Icons.User} />;
    return <CallMemberAvatar room={room} userId={userId} size="500" textSize="H4" />;
  };

  const tileTestProps = {
    'data-testid': 'call-tile',
    'data-user-id': userId,
    'data-video-source': source,
  };

  const tileClassName = classNames(
    css.CallTile,
    css.CallTileFillsFrame,
    isSpeaking && !isScreenshareSource && css.CallTileSpeaking,
    isFocused && css.CallTileFocused
  );

  const tileContent = (
    <>
      {videoTrack ? (
        <video
          ref={videoRef}
          className={classNames(
            css.CallTileVideo,
            isScreenshareSource ? css.CallTileVideoContain : css.CallTileVideoCover,
            participant.isLocal && !isScreenshareSource && css.CallTileVideoMirrored
          )}
          autoPlay
          playsInline
          muted
          data-testid="call-tile-video"
        />
      ) : (
        renderPlaceholder()
      )}
      {isPoppedOut && (
        <Box className={css.CallTilePopOutPlaceholder} data-testid="call-tile-pop-out-placeholder">
          <Text align="Center" size="T200">
            Playing in pop-out
          </Text>
        </Box>
      )}
      {!isScreenshareSource && isScreensharing && !isFocused && (
        <Box
          className={css.CallTileScreenshareBadge}
          alignItems="Center"
          gap="100"
          data-testid="call-tile-sharing-badge"
        >
          <Icon size="100" src={Icons.Monitor} filled />
          <Text as="span" size="T300">
            Sharing screen
          </Text>
        </Box>
      )}
      {!isScreenshareSource && (
        <Box className={css.CallTileName} alignItems="Center" gap="100">
          {isDeafenedLocally && <Icon size="100" src={Icons.Headphone} filled />}
          {isMutedLocally && <Icon size="100" src={Icons.VolumeMute} filled />}
          {isMuted && (
            <Icon size="100" src={Icons.MicMute} filled data-testid="call-tile-microphone-muted" />
          )}
          <Text as="span" size="T400" truncate>
            {displayName}
          </Text>
        </Box>
      )}
    </>
  );

  const tile = onSelect ? (
    <Box
      as="button"
      type="button"
      onClick={() => onSelect(participant.identity)}
      {...volumeMenuTriggerProps}
      aria-label={`Focus ${displayName}`}
      aria-pressed={isFocused}
      className={classNames(tileClassName, css.CallTileInteractive)}
      alignItems="Center"
      justifyContent="Center"
    >
      {tileContent}
    </Box>
  ) : (
    <Box
      className={tileClassName}
      {...volumeMenuTriggerProps}
      alignItems="Center"
      justifyContent="Center"
    >
      {tileContent}
    </Box>
  );

  return (
    <div className={classNames(css.CallTileFrame, className)} {...tileTestProps}>
      {tile}
      {isPopOutAvailable && (
        <button
          type="button"
          onClick={togglePopOut}
          aria-label="Pop out"
          aria-pressed={isPoppedOut}
          className={css.CallTilePopOutToggle}
          data-testid="call-tile-pop-out-toggle"
        >
          <Icon size="100" src={Icons.External} />
        </button>
      )}
      {volumeMenu}
    </div>
  );
}

export const CallParticipantTile = React.memo(CallParticipantTileComponent);
