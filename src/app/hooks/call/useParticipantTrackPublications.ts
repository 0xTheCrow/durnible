import { useEffect, useState } from 'react';
import type { Participant, TrackPublication } from 'livekit-client';
import { ParticipantEvent } from 'livekit-client';

const getTrackPublications = (participant: Participant): TrackPublication[] =>
  Array.from(participant.trackPublications.values());

const PUBLICATION_EVENTS = [
  ParticipantEvent.TrackPublished,
  ParticipantEvent.TrackUnpublished,
  ParticipantEvent.TrackSubscribed,
  ParticipantEvent.TrackUnsubscribed,
  ParticipantEvent.TrackMuted,
  ParticipantEvent.TrackUnmuted,
  ParticipantEvent.LocalTrackPublished,
  ParticipantEvent.LocalTrackUnpublished,
] as const;

export const useParticipantTrackPublications = (participant: Participant): TrackPublication[] => {
  const [trackPublications, setTrackPublications] = useState(() =>
    getTrackPublications(participant)
  );
  const [prev, setPrev] = useState(participant);
  if (prev !== participant) {
    setPrev(participant);
    setTrackPublications(getTrackPublications(participant));
  }

  useEffect(() => {
    const handlePublicationsChanged = () => {
      setTrackPublications(getTrackPublications(participant));
    };
    PUBLICATION_EVENTS.forEach((event) => participant.on(event, handlePublicationsChanged));
    return () => {
      PUBLICATION_EVENTS.forEach((event) => participant.off(event, handlePublicationsChanged));
    };
  }, [participant]);

  return trackPublications;
};
