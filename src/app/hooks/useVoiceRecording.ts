import { useCallback, useEffect, useRef, useState } from 'react';

export enum VoiceRecordingStatus {
  Idle = 'idle',
  Requesting = 'requesting',
  Recording = 'recording',
  Stopped = 'stopped',
  Error = 'error',
}

export type VoiceRecordingState =
  | { status: VoiceRecordingStatus.Idle }
  | { status: VoiceRecordingStatus.Requesting }
  | { status: VoiceRecordingStatus.Recording; duration: number }
  | { status: VoiceRecordingStatus.Stopped; blob: Blob; mimeType: string; duration: number }
  | { status: VoiceRecordingStatus.Error; error: string };

const getSupportedMimeType = (): string => {
  const candidates = [
    'audio/webm;codecs=opus',
    'audio/ogg;codecs=opus',
    'audio/webm',
    'audio/ogg',
  ];
  return candidates.find((t) => MediaRecorder.isTypeSupported(t)) ?? '';
};

export function useVoiceRecording() {
  const [state, setState] = useState<VoiceRecordingState>({ status: VoiceRecordingStatus.Idle });
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const durationRef = useRef(0);
  const mimeTypeRef = useRef('');

  const stopTimer = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const stopStream = useCallback(() => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
  }, []);

  const startRecording = useCallback(async () => {
    setState({ status: VoiceRecordingStatus.Requesting });
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      const mimeType = getSupportedMimeType();
      mimeTypeRef.current = mimeType;

      const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
      mediaRecorderRef.current = recorder;
      chunksRef.current = [];
      durationRef.current = 0;

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      recorder.onstop = () => {
        stopStream();
        stopTimer();
        const blob = new Blob(chunksRef.current, { type: mimeTypeRef.current });
        setState({
          status: VoiceRecordingStatus.Stopped,
          blob,
          mimeType: mimeTypeRef.current,
          duration: durationRef.current,
        });
      };

      recorder.start(100);
      setState({ status: VoiceRecordingStatus.Recording, duration: 0 });

      timerRef.current = setInterval(() => {
        durationRef.current += 1;
        setState({ status: VoiceRecordingStatus.Recording, duration: durationRef.current });
      }, 1000);
    } catch (err) {
      stopStream();
      setState({
        status: VoiceRecordingStatus.Error,
        error: err instanceof Error ? err.message : 'Microphone access denied',
      });
    }
  }, [stopStream, stopTimer]);

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current?.state === 'recording') {
      mediaRecorderRef.current.stop();
    }
  }, []);

  const cancelRecording = useCallback(() => {
    stopTimer();
    const recorder = mediaRecorderRef.current;
    if (recorder && recorder.state !== 'inactive') {
      recorder.onstop = null;
      recorder.stop();
    }
    stopStream();
    setState({ status: VoiceRecordingStatus.Idle });
  }, [stopTimer, stopStream]);

  const reset = useCallback(() => {
    setState({ status: VoiceRecordingStatus.Idle });
  }, []);

  useEffect(
    () => () => {
      stopTimer();
      stopStream();
      const recorder = mediaRecorderRef.current;
      if (recorder && recorder.state !== 'inactive') {
        recorder.onstop = null;
        recorder.stop();
      }
    },
    [stopTimer, stopStream]
  );

  return { state, startRecording, stopRecording, cancelRecording, reset };
}
