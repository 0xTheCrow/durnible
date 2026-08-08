import React, { useEffect, useRef } from 'react';
import { useAtomValue } from 'jotai';
import type { Participant } from 'livekit-client';
import { RemoteAudioTrack, Track } from 'livekit-client';
import { callStateAtom, isCallDeafenedAtom } from '../../state/call';
import {
  callVolumePreferencesAtom,
  getCallUserPlaybackVolumeLevel,
} from '../../state/callVolumePreferences';
import type { CallConnection } from '../../plugins/call/CallConnection';
import { useCallMemberships } from '../../hooks/useCallMemberships';
import { findCallParticipantUserId } from '../../utils/call';
import { useLivekitParticipants } from '../../hooks/call/useLivekitParticipants';
import { useParticipantTrackPublications } from '../../hooks/call/useParticipantTrackPublications';

type AudioTrackPlayerProps = {
  track: RemoteAudioTrack;
  isDeafened: boolean;
  volumeLevel: number;
};
function AudioTrackPlayer({ track, isDeafened, volumeLevel }: AudioTrackPlayerProps) {
  const audioElementRef = useRef<HTMLAudioElement>(null);

  useEffect(() => {
    const audioElement = audioElementRef.current;
    if (!audioElement) return undefined;
    track.attach(audioElement);
    return () => {
      track.detach(audioElement);
    };
  }, [track]);

  useEffect(() => {
    track.setVolume(volumeLevel);
  }, [track, volumeLevel]);

  return <audio ref={audioElementRef} autoPlay muted={isDeafened} />;
}

type ParticipantAudioProps = {
  participant: Participant;
  isDeafened: boolean;
  volumeLevel: number;
};
function ParticipantAudio({ participant, isDeafened, volumeLevel }: ParticipantAudioProps) {
  const trackPublications = useParticipantTrackPublications(participant);

  return (
    <>
      {trackPublications
        .filter((publication) => publication.kind === Track.Kind.Audio)
        .map((publication) =>
          publication.track instanceof RemoteAudioTrack ? (
            <AudioTrackPlayer
              key={publication.trackSid}
              track={publication.track}
              isDeafened={isDeafened}
              volumeLevel={volumeLevel}
            />
          ) : null
        )}
    </>
  );
}

type ConnectedCallAudioProps = {
  connection: CallConnection;
};
function ConnectedCallAudio({ connection }: ConnectedCallAudioProps) {
  const participants = useLivekitParticipants(connection.livekitRoom);
  const memberships = useCallMemberships(connection.matrixRoom);
  const isDeafened = useAtomValue(isCallDeafenedAtom);
  const volumePreferences = useAtomValue(callVolumePreferencesAtom);

  return (
    <>
      {participants
        .filter((participant) => !participant.isLocal)
        .map((participant) => {
          const userId = findCallParticipantUserId(participant.identity, memberships);
          return (
            <ParticipantAudio
              key={participant.identity}
              participant={participant}
              isDeafened={isDeafened}
              volumeLevel={getCallUserPlaybackVolumeLevel(volumePreferences, userId)}
            />
          );
        })}
    </>
  );
}

export function CallAudioRenderer() {
  const callState = useAtomValue(callStateAtom);

  if (callState.status !== 'connected' && callState.status !== 'reconnecting') return null;
  return <ConnectedCallAudio connection={callState.connection} />;
}
