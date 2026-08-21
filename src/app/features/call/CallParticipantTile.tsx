import React, { useEffect, useRef } from 'react';
import type { Room } from 'matrix-js-sdk';
import type { CallMembership } from 'matrix-js-sdk/lib/matrixrtc';
import type { Participant } from 'livekit-client';
import { Track } from 'livekit-client';
import { Box, Icon, Icons, Spinner, Text } from 'folds';
import classNames from 'classnames';
import { useAtomValue } from 'jotai';
import { isCallDeafenedAtom } from '../../state/call';
import type { CallVideoSourceKind } from '../../hooks/call/useCallParticipantEntries';
import { checkIsScreenshareAudioEnabled } from '../../hooks/call/useCallParticipantEntries';
import { useParticipantTrackPublications } from '../../hooks/call/useParticipantTrackPublications';
import { useIsParticipantSpeaking } from '../../hooks/call/useIsParticipantSpeaking';
import { useCallUserIsMuted } from '../../state/hooks/callVolumePreferences';
import { resolveCallParticipant } from '../../utils/call';
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

  const { userId, displayName } = resolveCallParticipant(room, participant.identity, memberships);

  const isMutedLocally = useCallUserIsMuted(userId);
  const { handleContextMenu, volumeMenu } = useCallUserVolumeMenu(
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

  const tileClassName = classNames(
    css.CallTile,
    className,
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
        />
      ) : (
        renderPlaceholder()
      )}
      {!isScreenshareSource && isScreensharing && !isFocused && (
        <Box className={css.CallTileScreenshareBadge} alignItems="Center" gap="100">
          <Icon size="50" src={Icons.Monitor} filled />
          <Text as="span" size="T200">
            Sharing
          </Text>
        </Box>
      )}
      {!isScreenshareSource && (
        <Box className={css.CallTileName} alignItems="Center" gap="100">
          {isDeafenedLocally && <Icon size="50" src={Icons.Headphone} filled />}
          {isMutedLocally && <Icon size="50" src={Icons.VolumeMute} filled />}
          {isMuted && <Icon size="50" src={Icons.MicMute} filled />}
          <Text as="span" size="T200" truncate>
            {displayName}
          </Text>
        </Box>
      )}
    </>
  );

  if (onSelect) {
    return (
      <>
        <Box
          as="button"
          type="button"
          onClick={() => onSelect(participant.identity)}
          onContextMenu={handleContextMenu}
          aria-label={`Focus ${displayName}`}
          aria-pressed={isFocused}
          className={classNames(tileClassName, css.CallTileInteractive)}
          alignItems="Center"
          justifyContent="Center"
        >
          {tileContent}
        </Box>
        {volumeMenu}
      </>
    );
  }

  return (
    <>
      <Box
        className={tileClassName}
        onContextMenu={handleContextMenu}
        alignItems="Center"
        justifyContent="Center"
      >
        {tileContent}
      </Box>
      {volumeMenu}
    </>
  );
}

export const CallParticipantTile = React.memo(CallParticipantTileComponent);
