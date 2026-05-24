import { renderHook } from '@testing-library/react';
import { useRef } from 'react';
import { describe, it, expect, beforeEach } from 'vitest';
import {
  AUDIO_VOLUME_STORAGE_KEY,
  VIDEO_VOLUME_STORAGE_KEY,
  useMediaVolumePersistence,
} from './useMediaVolumePersistence';

type Listener = () => void;

const createMockMedia = () => {
  const listeners = new Map<string, Set<Listener>>();
  return {
    volume: 1 as number,
    addEventListener(type: string, listener: Listener) {
      if (!listeners.has(type)) listeners.set(type, new Set());
      listeners.get(type)!.add(listener);
    },
    removeEventListener(type: string, listener: Listener) {
      listeners.get(type)?.delete(listener);
    },
    fire(type: string) {
      listeners.get(type)?.forEach((l) => l());
    },
  };
};

const renderWithMedia = (media: ReturnType<typeof createMockMedia>, storageKey: string) =>
  renderHook(() => {
    const ref = useRef(media as unknown as HTMLMediaElement);
    useMediaVolumePersistence(ref, storageKey);
  });

describe('useMediaVolumePersistence', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('defaults to 0.5 when localStorage is empty', () => {
    const media = createMockMedia();
    renderWithMedia(media, AUDIO_VOLUME_STORAGE_KEY);
    expect(media.volume).toBe(0.5);
  });

  it('restores a previously stored finite volume', () => {
    localStorage.setItem(AUDIO_VOLUME_STORAGE_KEY, '0.3');
    const media = createMockMedia();
    renderWithMedia(media, AUDIO_VOLUME_STORAGE_KEY);
    expect(media.volume).toBe(0.3);
  });

  it('clamps a stored value below 0 to 0', () => {
    localStorage.setItem(AUDIO_VOLUME_STORAGE_KEY, '-0.5');
    const media = createMockMedia();
    renderWithMedia(media, AUDIO_VOLUME_STORAGE_KEY);
    expect(media.volume).toBe(0);
  });

  it('clamps a stored value above 1 to 1', () => {
    localStorage.setItem(AUDIO_VOLUME_STORAGE_KEY, '2');
    const media = createMockMedia();
    renderWithMedia(media, AUDIO_VOLUME_STORAGE_KEY);
    expect(media.volume).toBe(1);
  });

  it('defaults to 0.5 when the stored value is non-numeric', () => {
    localStorage.setItem(AUDIO_VOLUME_STORAGE_KEY, 'garbage');
    const media = createMockMedia();
    renderWithMedia(media, AUDIO_VOLUME_STORAGE_KEY);
    expect(media.volume).toBe(0.5);
  });

  it('defaults to 0.5 when the stored value parses to NaN', () => {
    localStorage.setItem(AUDIO_VOLUME_STORAGE_KEY, 'NaN');
    const media = createMockMedia();
    renderWithMedia(media, AUDIO_VOLUME_STORAGE_KEY);
    expect(media.volume).toBe(0.5);
  });

  it('writes the current volume to localStorage on volumechange', () => {
    const media = createMockMedia();
    renderWithMedia(media, AUDIO_VOLUME_STORAGE_KEY);

    media.volume = 0.7;
    media.fire('volumechange');

    expect(localStorage.getItem(AUDIO_VOLUME_STORAGE_KEY)).toBe('0.7');
  });

  it('writes to the storage key that was passed in (audio vs video isolation)', () => {
    localStorage.setItem(AUDIO_VOLUME_STORAGE_KEY, '0.2');
    localStorage.setItem(VIDEO_VOLUME_STORAGE_KEY, '0.8');

    const audioMedia = createMockMedia();
    renderWithMedia(audioMedia, AUDIO_VOLUME_STORAGE_KEY);
    expect(audioMedia.volume).toBe(0.2);

    const videoMedia = createMockMedia();
    renderWithMedia(videoMedia, VIDEO_VOLUME_STORAGE_KEY);
    expect(videoMedia.volume).toBe(0.8);
  });

  it('detaches the volumechange listener on unmount', () => {
    const media = createMockMedia();
    const { unmount } = renderWithMedia(media, AUDIO_VOLUME_STORAGE_KEY);

    unmount();

    media.volume = 0.9;
    media.fire('volumechange');

    expect(localStorage.getItem(AUDIO_VOLUME_STORAGE_KEY)).toBeNull();
  });
});
