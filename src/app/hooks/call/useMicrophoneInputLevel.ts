import { useEffect, useState } from 'react';
import { monitorAudioLevel } from '../../plugins/call/audioLevel';

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
    let stopLevelMonitoring: (() => void) | undefined;

    const stopMonitoring = () => {
      stopLevelMonitoring?.();
      mediaStream?.getTracks().forEach((track) => track.stop());
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
      stopLevelMonitoring = monitorAudioLevel(mediaStream, setInputLevel);
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
