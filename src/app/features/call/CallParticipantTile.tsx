import React, { useEffect, useRef } from 'react';
import type { Room } from 'matrix-js-sdk';
import type { Participant } from 'livekit-client';
import { Track } from 'livekit-client';
import { Box, Icon, Icons, Text } from 'folds';
import classNames from 'classnames';
import { useParticipantTrackPublications } from '../../hooks/call/useParticipantTrackPublications';
import { getMemberDisplayName } from '../../utils/room';
import { CallMemberAvatar } from './CallMemberAvatar';
import * as css from './CallPane.css';

type CallParticipantTileProps = {
  room: Room;
  participant: Participant;
  userId: string | undefined;
  isSpeaking: boolean;
};
export function CallParticipantTile({
  room,
  participant,
  userId,
  isSpeaking,
}: CallParticipantTileProps) {
  const trackPublications = useParticipantTrackPublications(participant);
  const videoRef = useRef<HTMLVideoElement>(null);

  const cameraPublication = trackPublications.find(
    (publication) => publication.source === Track.Source.Camera
  );
  const microphonePublication = trackPublications.find(
    (publication) => publication.source === Track.Source.Microphone
  );
  const cameraTrack = cameraPublication?.isMuted ? undefined : cameraPublication?.track;
  const isMuted = microphonePublication === undefined || microphonePublication.isMuted;

  useEffect(() => {
    const videoElement = videoRef.current;
    if (!videoElement || !cameraTrack) return undefined;
    cameraTrack.attach(videoElement);
    return () => {
      cameraTrack.detach(videoElement);
    };
  }, [cameraTrack]);

  const displayName = userId ? getMemberDisplayName(room, userId) ?? userId : participant.identity;

  return (
    <Box
      className={classNames(css.CallTile, isSpeaking && css.CallTileSpeaking)}
      alignItems="Center"
      justifyContent="Center"
    >
      {cameraTrack ? (
        <video ref={videoRef} className={css.CallTileVideo} autoPlay playsInline muted />
      ) : (
        userId && <CallMemberAvatar room={room} userId={userId} size="500" textSize="H4" />
      )}
      <Box className={css.CallTileName} alignItems="Center" gap="100">
        {isMuted && <Icon size="50" src={Icons.MicMute} filled />}
        <Text as="span" size="T200" truncate>
          {displayName}
        </Text>
      </Box>
    </Box>
  );
}
