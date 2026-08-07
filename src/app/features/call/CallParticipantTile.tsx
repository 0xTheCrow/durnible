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
import { useParticipantTrackPublications } from '../../hooks/call/useParticipantTrackPublications';
import { resolveCallParticipant } from '../../utils/call';
import { CallMemberAvatar } from './CallMemberAvatar';
import * as css from './CallPane.css';

type CallParticipantTileProps = {
  room: Room;
  participant: Participant;
  source: CallVideoSourceKind;
  memberships: CallMembership[];
  isSpeaking: boolean;
  isScreensharing?: boolean;
  isFocused?: boolean;
  className: string;
  onSelect?: () => void;
};
export function CallParticipantTile({
  room,
  participant,
  source,
  memberships,
  isSpeaking,
  isScreensharing,
  isFocused,
  className,
  onSelect,
}: CallParticipantTileProps) {
  const trackPublications = useParticipantTrackPublications(participant);
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

  useEffect(() => {
    const videoElement = videoRef.current;
    if (!videoElement || !videoTrack) return undefined;
    videoTrack.attach(videoElement);
    return () => {
      videoTrack.detach(videoElement);
    };
  }, [videoTrack]);

  const { userId, displayName: memberName } = resolveCallParticipant(
    room,
    participant.identity,
    memberships
  );
  let displayName = memberName;
  if (isScreenshareSource) {
    displayName = participant.isLocal ? 'Your screen' : `${memberName}'s screen`;
  }

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
      <Box className={css.CallTileName} alignItems="Center" gap="100">
        {!isScreenshareSource && isDeafenedLocally && (
          <Icon size="50" src={Icons.Headphone} filled />
        )}
        {!isScreenshareSource && isMuted && <Icon size="50" src={Icons.MicMute} filled />}
        {!isScreenshareSource && isScreensharing && <Icon size="50" src={Icons.Monitor} filled />}
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
        aria-label={`Focus ${displayName}`}
        aria-pressed={isFocused}
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
