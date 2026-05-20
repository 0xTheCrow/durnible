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
    const el = ref.current;
    if (!el) return undefined;

    const stored = localStorage.getItem(storageKey);
    const parsed = stored !== null ? parseFloat(stored) : NaN;
    el.volume = Number.isFinite(parsed) ? Math.max(0, Math.min(1, parsed)) : DEFAULT_VOLUME;

    const handleVolumeChange = () => {
      localStorage.setItem(storageKey, String(el.volume));
    };

    el.addEventListener('volumechange', handleVolumeChange);
    return () => el.removeEventListener('volumechange', handleVolumeChange);
  }, [ref, storageKey]);
};
