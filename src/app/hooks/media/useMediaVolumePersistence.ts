import type { RefObject } from 'react';
import { useEffect } from 'react';

export const VIDEO_VOLUME_STORAGE_KEY = 'durnible_video_volume';
export const AUDIO_VOLUME_STORAGE_KEY = 'durnible_audio_volume';

const DEFAULT_VOLUME = 0.5;

export const useMediaVolumePersistence = (
  ref: RefObject<HTMLMediaElement>,
  storageKey: string
): void => {
  useEffect(() => {
    const mediaElement = ref.current;
    if (!mediaElement) return undefined;

    const stored = localStorage.getItem(storageKey);
    const parsed = stored !== null ? parseFloat(stored) : NaN;
    mediaElement.volume = Number.isFinite(parsed)
      ? Math.max(0, Math.min(1, parsed))
      : DEFAULT_VOLUME;

    const handleVolumeChange = () => {
      localStorage.setItem(storageKey, String(mediaElement.volume));
    };

    mediaElement.addEventListener('volumechange', handleVolumeChange);
    return () => mediaElement.removeEventListener('volumechange', handleVolumeChange);
  }, [ref, storageKey]);
};
