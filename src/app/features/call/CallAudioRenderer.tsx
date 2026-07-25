import React, { useEffect, useRef } from 'react';
import { useAtomValue } from 'jotai';
import type { Participant, Room as LivekitRoom } from 'livekit-client';
import { Track } from 'livekit-client';
import { callStateAtom } from '../../state/call';
import { useLivekitParticipants } from '../../hooks/call/useLivekitParticipants';
import { useParticipantTrackPublications } from '../../hooks/call/useParticipantTrackPublications';

function AudioTrackPlayer({ track }: { track: Track }) {
  const audioElementRef = useRef<HTMLAudioElement>(null);

  useEffect(() => {
    const audioElement = audioElementRef.current;
    if (!audioElement) return undefined;
    track.attach(audioElement);
    return () => {
      track.detach(audioElement);
    };
  }, [track]);

  return <audio ref={audioElementRef} autoPlay />;
}

function ParticipantAudio({ participant }: { participant: Participant }) {
  const trackPublications = useParticipantTrackPublications(participant);

  return (
    <>
      {trackPublications
        .filter((publication) => publication.kind === Track.Kind.Audio)
        .map((publication) =>
          publication.track ? (
            <AudioTrackPlayer key={publication.trackSid} track={publication.track} />
          ) : null
        )}
    </>
  );
}

function ConnectedCallAudio({ livekitRoom }: { livekitRoom: LivekitRoom }) {
  const participants = useLivekitParticipants(livekitRoom);

  return (
    <>
      {participants
        .filter((participant) => !participant.isLocal)
        .map((participant) => (
          <ParticipantAudio key={participant.identity} participant={participant} />
        ))}
    </>
  );
}

export function CallAudioRenderer() {
  const callState = useAtomValue(callStateAtom);

  if (callState.status !== 'connected' && callState.status !== 'reconnecting') return null;
  return <ConnectedCallAudio livekitRoom={callState.connection.livekitRoom} />;
}
