import React, { useEffect, useRef } from 'react';
import type { Room } from 'matrix-js-sdk';
import type { Participant } from 'livekit-client';
import { Track } from 'livekit-client';
import { Box, Icon, Icons, Text } from 'folds';
import classNames from 'classnames';
import type { CallVideoSourceKind } from '../../hooks/call/useCallVideoSources';
import { useParticipantTrackPublications } from '../../hooks/call/useParticipantTrackPublications';
import { getMemberDisplayName } from '../../utils/room';
import { CallMemberAvatar } from './CallMemberAvatar';
import * as css from './CallPane.css';

type CallParticipantTileProps = {
  room: Room;
  participant: Participant;
  source: CallVideoSourceKind;
  userId: string | undefined;
  isSpeaking: boolean;
  className: string;
  onSelect?: () => void;
};
export function CallParticipantTile({
  room,
  participant,
  source,
  userId,
  isSpeaking,
  className,
  onSelect,
}: CallParticipantTileProps) {
  const trackPublications = useParticipantTrackPublications(participant);
  const videoRef = useRef<HTMLVideoElement>(null);

  const isScreenshare = source === Track.Source.ScreenShare;
  const videoPublication = trackPublications.find((publication) => publication.source === source);
  const microphonePublication = trackPublications.find(
    (publication) => publication.source === Track.Source.Microphone
  );
  const videoTrack = videoPublication?.isMuted ? undefined : videoPublication?.track;
  const isMuted = microphonePublication === undefined || microphonePublication.isMuted;

  useEffect(() => {
    const videoElement = videoRef.current;
    if (!videoElement || !videoTrack) return undefined;
    videoTrack.attach(videoElement);
    return () => {
      videoTrack.detach(videoElement);
    };
  }, [videoTrack]);

  const memberName = userId ? getMemberDisplayName(room, userId) ?? userId : participant.identity;
  let displayName = memberName;
  if (isScreenshare) {
    displayName = participant.isLocal ? 'Your screen' : `${memberName}'s screen`;
  }

  const renderPlaceholder = () => {
    if (isScreenshare) return <Icon size="400" src={Icons.Monitor} />;
    return userId && <CallMemberAvatar room={room} userId={userId} size="500" textSize="H4" />;
  };

  const tileClassName = classNames(
    css.CallTile,
    className,
    isSpeaking && !isScreenshare && css.CallTileSpeaking
  );

  const tileContent = (
    <>
      {videoTrack ? (
        <video
          ref={videoRef}
          className={classNames(
            css.CallTileVideo,
            isScreenshare ? css.CallTileVideoContain : css.CallTileVideoCover,
            participant.isLocal && !isScreenshare && css.CallTileVideoMirrored
          )}
          autoPlay
          playsInline
          muted
        />
      ) : (
        renderPlaceholder()
      )}
      <Box className={css.CallTileName} alignItems="Center" gap="100">
        {!isScreenshare && isMuted && <Icon size="50" src={Icons.MicMute} filled />}
        <Text as="span" size="T200" truncate>
          {displayName}
        </Text>
      </Box>
    </>
  );

  if (onSelect) {
    return (
      <Box
        as="button"
        type="button"
        onClick={onSelect}
        aria-label={`Spotlight ${displayName}`}
        className={classNames(tileClassName, css.CallTileInteractive)}
        alignItems="Center"
        justifyContent="Center"
      >
        {tileContent}
      </Box>
    );
  }

  return (
    <Box className={tileClassName} alignItems="Center" justifyContent="Center">
      {tileContent}
    </Box>
  );
}
