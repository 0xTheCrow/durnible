import React, { useEffect, useRef } from 'react';
import { useAtomValue, useSetAtom, useStore } from 'jotai';
import type { Participant } from 'livekit-client';
import { RemoteAudioTrack, Track } from 'livekit-client';
import {
  callFocusedParticipantAtom,
  callStateAtom,
  getCallFocusedParticipantKey,
  isCallDeafenedAtom,
} from '../../state/call';
import {
  callVolumePreferencesAtom,
  getCallScreensharePlaybackVolumeLevel,
  getCallUserPlaybackVolumeLevel,
  getCallUserVolumePreference,
  setCallUserVolumePreferenceAtom,
} from '../../state/callVolumePreferences';
import type { CallConnection } from '../../plugins/call/CallConnection';
import { useCallMemberships } from '../../hooks/useCallMemberships';
import { findCallParticipantUserId } from '../../utils/call';
import { useLivekitParticipants } from '../../hooks/call/useLivekitParticipants';
import { useParticipantTrackPublications } from '../../hooks/call/useParticipantTrackPublications';

type AudioTrackPlayerProps = {
  track: RemoteAudioTrack;
  userId?: string;
  isDeafened: boolean;
  volumeLevel: number;
};
function AudioTrackPlayer({ track, userId, isDeafened, volumeLevel }: AudioTrackPlayerProps) {
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

  return (
    <audio
      ref={audioElementRef}
      autoPlay
      muted={isDeafened}
      data-testid="call-participant-audio"
      data-user-id={userId}
      data-track-source={track.source}
    />
  );
}

type ParticipantAudioProps = {
  participant: Participant;
  userId?: string;
  isDeafened: boolean;
  microphoneVolumeLevel: number;
  screenshareVolumeLevel: number;
  isWatchingScreenshare: boolean;
};
function ParticipantAudio({
  participant,
  userId,
  isDeafened,
  microphoneVolumeLevel,
  screenshareVolumeLevel,
  isWatchingScreenshare,
}: ParticipantAudioProps) {
  const trackPublications = useParticipantTrackPublications(participant);
  const store = useStore();
  const setUserVolumePreference = useSetAtom(setCallUserVolumePreferenceAtom);
  const screenshareAudioTrackSid = trackPublications.find(
    (publication) => publication.source === Track.Source.ScreenShareAudio
  )?.trackSid;

  useEffect(() => {
    if (!screenshareAudioTrackSid || !userId) return;
    const { isMuted, isScreenshareMuted } = getCallUserVolumePreference(
      store.get(callVolumePreferencesAtom),
      userId
    );
    if (isMuted && !isScreenshareMuted) {
      setUserVolumePreference({
        userId,
        preference: { isScreenshareMuted: true },
        isCommit: true,
      });
    }
  }, [screenshareAudioTrackSid, userId, store, setUserVolumePreference]);

  return (
    <>
      {trackPublications
        .filter(
          (publication) =>
            publication.kind === Track.Kind.Audio &&
            (publication.source !== Track.Source.ScreenShareAudio || isWatchingScreenshare)
        )
        .map((publication) =>
          publication.track instanceof RemoteAudioTrack ? (
            <AudioTrackPlayer
              key={publication.trackSid}
              track={publication.track}
              userId={userId}
              isDeafened={isDeafened}
              volumeLevel={
                publication.source === Track.Source.ScreenShareAudio
                  ? screenshareVolumeLevel
                  : microphoneVolumeLevel
              }
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
  const focusedParticipant = useAtomValue(callFocusedParticipantAtom);
  const focusedParticipantKey = getCallFocusedParticipantKey(focusedParticipant, connection);

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
              userId={userId}
              isDeafened={isDeafened}
              microphoneVolumeLevel={getCallUserPlaybackVolumeLevel(volumePreferences, userId)}
              screenshareVolumeLevel={getCallScreensharePlaybackVolumeLevel(
                volumePreferences,
                userId
              )}
              isWatchingScreenshare={participant.identity === focusedParticipantKey}
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
