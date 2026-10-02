import { useEffect, useState } from 'react';
import type { LocalTrack, ScreenShareCaptureOptions } from 'livekit-client';
import { createLocalScreenTracks, LocalAudioTrack, LocalVideoTrack } from 'livekit-client';
import { settingsAtom } from '../../state/settings';
import { useSetting } from '../../state/hooks/settings';
import {
  applyScreenshareQuality,
  getScreenshareCaptureOptions,
} from '../../plugins/call/screenshare';
import { checkIsCaptureCancelled } from '../../plugins/call/localMedia';

export type ScreenshareTestTracks = {
  videoTrack: LocalVideoTrack;
  audioTrack?: LocalAudioTrack;
};

export const useScreenshareTest = (): {
  testTracks?: ScreenshareTestTracks;
  isTesting: boolean;
  startTest: () => void;
  stopTest: () => void;
} => {
  const [resolution] = useSetting(settingsAtom, 'screenshareResolution');
  const [maxFrameRate] = useSetting(settingsAtom, 'screenshareMaxFrameRate');
  const [captureOptions, setCaptureOptions] = useState<ScreenShareCaptureOptions>();
  const [testTracks, setTestTracks] = useState<ScreenshareTestTracks>();

  useEffect(() => {
    if (!captureOptions) return undefined;

    let isCancelled = false;
    let capturedTracks: LocalTrack[] = [];
    const stopTest = () => setCaptureOptions(undefined);

    const startCapture = async () => {
      try {
        capturedTracks = await createLocalScreenTracks(captureOptions);
      } catch (error) {
        if (isCancelled) return;
        if (!checkIsCaptureCancelled(error)) {
          console.error('useScreenshareTest: failed to capture screen', error);
        }
        stopTest();
        return;
      }
      if (isCancelled) {
        capturedTracks.forEach((track) => track.stop());
        return;
      }

      const videoTrack = capturedTracks.find(
        (track): track is LocalVideoTrack => track instanceof LocalVideoTrack
      );
      const audioTrack = capturedTracks.find(
        (track): track is LocalAudioTrack => track instanceof LocalAudioTrack
      );
      if (!videoTrack) {
        stopTest();
        return;
      }
      videoTrack.mediaStreamTrack.addEventListener('ended', stopTest);
      setTestTracks({ videoTrack, audioTrack });
    };

    startCapture();
    return () => {
      isCancelled = true;
      capturedTracks.forEach((track) => {
        track.mediaStreamTrack.removeEventListener('ended', stopTest);
        track.stop();
      });
      setTestTracks(undefined);
    };
  }, [captureOptions]);

  useEffect(() => {
    if (!testTracks) return;
    applyScreenshareQuality(testTracks.videoTrack, resolution, maxFrameRate).catch((error) =>
      console.error('useScreenshareTest: failed to apply screenshare quality', error)
    );
  }, [testTracks, resolution, maxFrameRate]);

  return {
    testTracks,
    isTesting: captureOptions !== undefined,
    startTest: () => setCaptureOptions(getScreenshareCaptureOptions(resolution, maxFrameRate)),
    stopTest: () => setCaptureOptions(undefined),
  };
};
