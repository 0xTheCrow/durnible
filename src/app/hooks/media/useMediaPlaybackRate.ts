import { useCallback, useEffect, useState } from 'react';

export type MediaPlaybackRateData = {
  playbackRate: number;
};
export type MediaPlaybackRateControl = {
  setPlaybackRate: (rate: number) => void;
};

export const useMediaPlaybackRate = (
  getTargetElement: () => HTMLMediaElement | null
): MediaPlaybackRateData & MediaPlaybackRateControl => {
  const [rate, setRate] = useState(1.0);

  const setPlaybackRate = useCallback(
    (playbackRate: number) => {
      const mediaElement = getTargetElement();
      if (!mediaElement) return;
      mediaElement.playbackRate = playbackRate;
    },
    [getTargetElement]
  );

  useEffect(() => {
    const mediaElement = getTargetElement();
    const handleChange = () => {
      if (!mediaElement) return;
      setRate(mediaElement.playbackRate);
    };
    mediaElement?.addEventListener('ratechange', handleChange);
    return () => {
      mediaElement?.removeEventListener('ratechange', handleChange);
    };
  }, [getTargetElement]);

  return {
    playbackRate: rate,
    setPlaybackRate,
  };
};
