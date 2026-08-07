import { useRef } from 'react';
import { useAtom } from 'jotai';
import type { Room as LivekitRoom } from 'livekit-client';
import { isCallDeafenedAtom } from '../../state/call';

export const useCallDeafen = (
  livekitRoom: LivekitRoom
): { isDeafened: boolean; toggleDeafen: () => Promise<void> } => {
  const [isDeafened, setIsDeafened] = useAtom(isCallDeafenedAtom);
  const wasMicrophoneEnabledRef = useRef(false);

  const toggleDeafen = async () => {
    const { localParticipant } = livekitRoom;
    if (isDeafened) {
      setIsDeafened(false);
      if (wasMicrophoneEnabledRef.current) {
        await localParticipant.setMicrophoneEnabled(true).catch(() => undefined);
      }
      return;
    }
    wasMicrophoneEnabledRef.current = localParticipant.isMicrophoneEnabled;
    setIsDeafened(true);
    await localParticipant.setMicrophoneEnabled(false).catch(() => undefined);
  };

  return { isDeafened, toggleDeafen };
};
