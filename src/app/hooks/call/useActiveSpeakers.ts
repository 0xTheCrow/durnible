import { useEffect, useState } from 'react';
import type { Participant, Room as LivekitRoom } from 'livekit-client';
import { RoomEvent } from 'livekit-client';

export const useActiveSpeakers = (livekitRoom: LivekitRoom): Participant[] => {
  const [activeSpeakers, setActiveSpeakers] = useState<Participant[]>(
    () => livekitRoom.activeSpeakers
  );
  const [prev, setPrev] = useState(livekitRoom);
  if (prev !== livekitRoom) {
    setPrev(livekitRoom);
    setActiveSpeakers(livekitRoom.activeSpeakers);
  }

  useEffect(() => {
    const handleActiveSpeakersChanged = (speakers: Participant[]) => {
      setActiveSpeakers(speakers);
    };
    livekitRoom.on(RoomEvent.ActiveSpeakersChanged, handleActiveSpeakersChanged);
    return () => {
      livekitRoom.off(RoomEvent.ActiveSpeakersChanged, handleActiveSpeakersChanged);
    };
  }, [livekitRoom]);

  return activeSpeakers;
};
