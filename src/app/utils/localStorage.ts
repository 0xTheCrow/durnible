import { SETTINGS_STORAGE_KEY } from '../state/settings';
import { KEYBINDS_STORAGE_KEY } from '../state/keybinds';
import {
  AUDIO_VOLUME_STORAGE_KEY,
  VIDEO_VOLUME_STORAGE_KEY,
} from '../hooks/media/useMediaVolumePersistence';

export const DEVICE_STORAGE_KEYS: string[] = [
  SETTINGS_STORAGE_KEY,
  KEYBINDS_STORAGE_KEY,
  VIDEO_VOLUME_STORAGE_KEY,
  AUDIO_VOLUME_STORAGE_KEY,
];

export const clearAccountScopedStorage = (): void => {
  const preservedKeys = new Set(DEVICE_STORAGE_KEYS);
  Object.keys(localStorage)
    .filter((key) => !preservedKeys.has(key))
    .forEach((key) => localStorage.removeItem(key));
};
