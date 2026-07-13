import { useEffect, useState } from 'react';
import type { Participant, Room as LivekitRoom } from 'livekit-client';
import { RoomEvent } from 'livekit-client';

const getParticipants = (livekitRoom: LivekitRoom): Participant[] => [
  livekitRoom.localParticipant,
  ...livekitRoom.remoteParticipants.values(),
];

export const useLivekitParticipants = (livekitRoom: LivekitRoom): Participant[] => {
  const [participants, setParticipants] = useState(() => getParticipants(livekitRoom));
  const [prev, setPrev] = useState(livekitRoom);
  if (prev !== livekitRoom) {
    setPrev(livekitRoom);
    setParticipants(getParticipants(livekitRoom));
  }

  useEffect(() => {
    const handleParticipantsChanged = () => {
      setParticipants(getParticipants(livekitRoom));
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
