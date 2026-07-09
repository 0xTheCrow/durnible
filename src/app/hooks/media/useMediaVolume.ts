import { useCallback, useEffect, useState } from 'react';

export type MediaVolumeData = {
  volume: number;
  mute: boolean;
};

export type MediaVolumeControl = {
  setMute: (mute: boolean) => void;
  setVolume: (volume: number) => void;
};

export const useMediaVolume = (
  getTargetElement: () => HTMLMediaElement | null
): MediaVolumeData & MediaVolumeControl => {
  const [volumeData, setVolumeData] = useState<MediaVolumeData>({
    volume: 1,
    mute: false,
  });

  const setMute = useCallback(
    (mute: boolean) => {
      const mediaElement = getTargetElement();
      if (!mediaElement) return;
      mediaElement.muted = mute;
    },
    [getTargetElement]
  );

  const setVolume = useCallback(
    (volume: number) => {
      const mediaElement = getTargetElement();
      if (!mediaElement) return;
      mediaElement.volume = volume;
    },
    [getTargetElement]
  );

  useEffect(() => {
    const mediaElement = getTargetElement();
    const handleChange = () => {
      if (!mediaElement) return;

      setVolumeData({
        mute: mediaElement.muted,
        volume: Math.max(0, Math.min(mediaElement.volume, 1)),
      });
    };
    mediaElement?.addEventListener('volumechange', handleChange);
    return () => {
      mediaElement?.removeEventListener('volumechange', handleChange);
    };
  }, [getTargetElement]);

  return {
    ...volumeData,
    setMute,
    setVolume,
  };
};
