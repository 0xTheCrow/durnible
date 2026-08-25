import { useEffect, useState } from 'react';
import {
  AUDIO_LEVEL_SAMPLE_INTERVAL_MS,
  createAudioLevelMeter,
} from '../../plugins/call/audioLevel';

export type MicrophoneInputLevel = {
  inputLevel: number;
  isMicrophoneAvailable: boolean;
};

export const useMicrophoneInputLevel = (
  audioInputDeviceId?: string,
  isEnabled = false
): MicrophoneInputLevel => {
  const [inputLevel, setInputLevel] = useState(0);
  const [isMicrophoneAvailable, setIsMicrophoneAvailable] = useState(false);

  useEffect(() => {
    if (!isEnabled) {
      setInputLevel(0);
      setIsMicrophoneAvailable(false);
      return undefined;
    }

    let isCancelled = false;
    let mediaStream: MediaStream | undefined;
    let audioContext: AudioContext | undefined;
    let sampleIntervalId: ReturnType<typeof setInterval> | undefined;

    const stopMonitoring = () => {
      if (sampleIntervalId !== undefined) clearInterval(sampleIntervalId);
      mediaStream?.getTracks().forEach((track) => track.stop());
      audioContext?.close();
    };

    const startMonitoring = async () => {
      try {
        mediaStream = await navigator.mediaDevices.getUserMedia({
          audio: audioInputDeviceId ? { deviceId: { exact: audioInputDeviceId } } : true,
        });
      } catch {
        if (!isCancelled) setIsMicrophoneAvailable(false);
        return;
      }
      if (isCancelled) {
        stopMonitoring();
        return;
      }

      setIsMicrophoneAvailable(true);
      audioContext = new AudioContext();
      const meter = createAudioLevelMeter(audioContext);
      audioContext.createMediaStreamSource(mediaStream).connect(meter.analyserNode);
      sampleIntervalId = setInterval(
        () => setInputLevel(meter.measureLevel()),
        AUDIO_LEVEL_SAMPLE_INTERVAL_MS
      );
    };

    startMonitoring();
    return () => {
      isCancelled = true;
      setInputLevel(0);
      stopMonitoring();
    };
  }, [audioInputDeviceId, isEnabled]);

  return { inputLevel, isMicrophoneAvailable };
};
