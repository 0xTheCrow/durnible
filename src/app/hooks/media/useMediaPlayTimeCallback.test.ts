import { renderHook } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { useMediaPlayTimeCallback } from './useMediaPlayTimeCallback';

type Listener = () => void;

const createMockMedia = () => {
  const listeners = new Map<string, Set<Listener>>();
  return {
    duration: 0 as number,
    currentTime: 0 as number,
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

const renderWithMedia = (media: ReturnType<typeof createMockMedia>) => {
  const cb = vi.fn();
  const getTarget = () => media as unknown as HTMLMediaElement;
  renderHook(() => useMediaPlayTimeCallback(getTarget, cb));
  return cb;
};

describe('useMediaPlayTimeCallback', () => {
  it('reports finite duration unchanged', () => {
    const media = createMockMedia();
    media.duration = 42.5;
    media.currentTime = 1.25;
    const cb = renderWithMedia(media);

    media.fire('loadedmetadata');

    expect(cb).toHaveBeenCalledWith(42.5, 1.25);
  });

  it('reports 0 when duration is Infinity', () => {
    const media = createMockMedia();
    media.duration = Infinity;
    media.currentTime = 3;
    const cb = renderWithMedia(media);

    media.fire('loadedmetadata');

    expect(cb).toHaveBeenCalledWith(0, 3);
  });

  it('reports 0 when duration is NaN', () => {
    const media = createMockMedia();
    media.duration = NaN;
    media.currentTime = 0;
    const cb = renderWithMedia(media);

    media.fire('loadedmetadata');

    expect(cb).toHaveBeenCalledWith(0, 0);
  });

  it('re-sanitizes on every event (handles Infinity → finite transition)', () => {
    const media = createMockMedia();
    media.duration = Infinity;
    const cb = renderWithMedia(media);

    media.fire('timeupdate');
    expect(cb).toHaveBeenLastCalledWith(0, 0);

    media.duration = 10;
    media.currentTime = 4;
    media.fire('timeupdate');
    expect(cb).toHaveBeenLastCalledWith(10, 4);
  });
});
