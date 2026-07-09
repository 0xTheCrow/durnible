import { useCallback, useEffect, useState } from 'react';

export type MediaPlayData = {
  playing: boolean;
};

export type MediaPlayControl = {
  setPlaying: (play: boolean) => void;
};

export const useMediaPlay = (
  getTargetElement: () => HTMLMediaElement | null
): MediaPlayData & MediaPlayControl => {
  const [playing, setPlay] = useState(false);

  const setPlaying = useCallback(
    (play: boolean) => {
      const mediaElement = getTargetElement();
      if (!mediaElement) return;
      if (play) mediaElement.play();
      else mediaElement.pause();
    },
    [getTargetElement]
  );

  useEffect(() => {
    const mediaElement = getTargetElement();
    const handleChange = () => {
      if (!mediaElement) return;
      setPlay(mediaElement.paused === false);
    };
    mediaElement?.addEventListener('playing', handleChange);
    mediaElement?.addEventListener('play', handleChange);
    mediaElement?.addEventListener('pause', handleChange);
    return () => {
      mediaElement?.removeEventListener('playing', handleChange);
      mediaElement?.removeEventListener('play', handleChange);
      mediaElement?.removeEventListener('pause', handleChange);
    };
  }, [getTargetElement]);

  return {
    playing,
    setPlaying,
  };
};
