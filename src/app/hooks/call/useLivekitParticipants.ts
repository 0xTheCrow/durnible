import { useEffect, useState } from 'react';
import type { Participant, Room as LivekitRoom } from 'livekit-client';
import { RoomEvent } from 'livekit-client';

export const getLivekitParticipants = (livekitRoom: LivekitRoom): Participant[] => [
  livekitRoom.localParticipant,
  ...livekitRoom.remoteParticipants.values(),
];

export const useLivekitParticipants = (livekitRoom: LivekitRoom): Participant[] => {
  const [participants, setParticipants] = useState(() => getLivekitParticipants(livekitRoom));
  const [prev, setPrev] = useState(livekitRoom);
  if (prev !== livekitRoom) {
    setPrev(livekitRoom);
    setParticipants(getLivekitParticipants(livekitRoom));
  }

  useEffect(() => {
    const handleParticipantsChanged = () => {
      setParticipants(getLivekitParticipants(livekitRoom));
    };
    livekitRoom.on(RoomEvent.ParticipantConnected, handleParticipantsChanged);
    livekitRoom.on(RoomEvent.ParticipantDisconnected, handleParticipantsChanged);
    return () => {
      livekitRoom.off(RoomEvent.ParticipantConnected, handleParticipantsChanged);
      livekitRoom.off(RoomEvent.ParticipantDisconnected, handleParticipantsChanged);
    };
  }, [livekitRoom]);

  return participants;
};
