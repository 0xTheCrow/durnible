import { useEffect, useRef } from 'react';
import type { Room as LivekitRoom } from 'livekit-client';
import { ParticipantEvent, Track } from 'livekit-client';
import { useSetting } from '../../state/hooks/settings';
import { settingsAtom } from '../../state/settings';
import { MicrophoneInputFloorProcessor } from '../../plugins/call/MicrophoneInputFloorProcessor';

export const useMicrophoneInputFloor = (livekitRoom: LivekitRoom | undefined): void => {
  const [microphoneInputFloorLevel] = useSetting(settingsAtom, 'microphoneInputFloorLevel');
  const inputFloorLevelRef = useRef(microphoneInputFloorLevel);
  const processorRef = useRef<MicrophoneInputFloorProcessor>();
  const isInputFloorEnabled = microphoneInputFloorLevel > 0;

  useEffect(() => {
    inputFloorLevelRef.current = microphoneInputFloorLevel;
    processorRef.current?.setInputFloorLevel(microphoneInputFloorLevel);
  }, [microphoneInputFloorLevel]);

  useEffect(() => {
    if (!livekitRoom || !isInputFloorEnabled) return undefined;
    const { localParticipant } = livekitRoom;

    const getMicrophoneTrack = () =>
      localParticipant.getTrackPublication(Track.Source.Microphone)?.audioTrack;

    const attachProcessor = async () => {
      const microphoneTrack = getMicrophoneTrack();
      if (!microphoneTrack || microphoneTrack.getProcessor()) return;
      const processor = new MicrophoneInputFloorProcessor(inputFloorLevelRef.current);
      processorRef.current = processor;
      try {
        await microphoneTrack.setProcessor(processor);
      } catch (error) {
        processorRef.current = undefined;
        console.error('useMicrophoneInputFloor: failed to attach input floor processor', error);
      }
    };

    attachProcessor();
    localParticipant.on(ParticipantEvent.LocalTrackPublished, attachProcessor);
    return () => {
      localParticipant.off(ParticipantEvent.LocalTrackPublished, attachProcessor);
      processorRef.current = undefined;
      getMicrophoneTrack()
        ?.stopProcessor()
        .catch((error) =>
          console.error('useMicrophoneInputFloor: failed to detach input floor processor', error)
        );
    };
  }, [livekitRoom, isInputFloorEnabled]);
};
