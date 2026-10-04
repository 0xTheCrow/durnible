import { useEffect, useState } from 'react';
import { monitorAudioLevel } from '../../plugins/call/audioLevel';

export const useAudioTrackLevel = (mediaStreamTrack: MediaStreamTrack | undefined): number => {
  const [level, setLevel] = useState(0);

  useEffect(() => {
    if (!mediaStreamTrack) return undefined;
    const stopLevelMonitoring = monitorAudioLevel(new MediaStream([mediaStreamTrack]), setLevel);
    return () => {
      stopLevelMonitoring();
      setLevel(0);
    };
  }, [mediaStreamTrack]);

  return level;
};
