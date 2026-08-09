import { useEffect, useState } from 'react';
import type { Participant } from 'livekit-client';
import { ParticipantEvent } from 'livekit-client';

export const useIsParticipantSpeaking = (participant: Participant): boolean => {
  const [isSpeaking, setIsSpeaking] = useState(() => participant.isSpeaking);
  const [prev, setPrev] = useState(participant);
  if (prev !== participant) {
    setPrev(participant);
    setIsSpeaking(participant.isSpeaking);
  }

  useEffect(() => {
    const handleIsSpeakingChanged = (speaking: boolean) => {
      setIsSpeaking(speaking);
    };
    participant.on(ParticipantEvent.IsSpeakingChanged, handleIsSpeakingChanged);
    return () => {
      participant.off(ParticipantEvent.IsSpeakingChanged, handleIsSpeakingChanged);
    };
  }, [participant]);

  return isSpeaking;
};
