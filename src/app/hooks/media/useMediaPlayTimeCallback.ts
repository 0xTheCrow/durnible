import { useEffect } from 'react';

export type PlayTimeCallback = (duration: number, currentTime: number) => void;

export const useMediaPlayTimeCallback = (
  getTargetElement: () => HTMLMediaElement | null,
  onPlayTimeCallback: PlayTimeCallback
): void => {
  useEffect(() => {
    const mediaElement = getTargetElement();
    const handleChange = () => {
      if (!mediaElement) return;
      const duration = Number.isFinite(mediaElement.duration) ? mediaElement.duration : 0;
      onPlayTimeCallback(duration, mediaElement.currentTime);
    };
    mediaElement?.addEventListener('timeupdate', handleChange);
    mediaElement?.addEventListener('loadedmetadata', handleChange);
    mediaElement?.addEventListener('ended', handleChange);
    return () => {
      mediaElement?.removeEventListener('timeupdate', handleChange);
      mediaElement?.removeEventListener('loadedmetadata', handleChange);
      mediaElement?.removeEventListener('ended', handleChange);
    };
  }, [getTargetElement, onPlayTimeCallback]);
};
