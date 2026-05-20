import { renderHook, act } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { useMediaSeek } from './useMediaSeek';

type Listener = () => void;

const createMockMedia = () => {
  const listeners = new Map<string, Set<Listener>>();
  return {
    duration: 0 as number,
    currentTime: 0 as number,
    seeking: false,
    seekable: undefined as TimeRanges | undefined,
    addEventListener(type: string, listener: Listener) {
      if (!listeners.has(type)) listeners.set(type, new Set());
      listeners.get(type)!.add(listener);
    },
    removeEventListener(type: string, listener: Listener) {
      listeners.get(type)?.delete(listener);
    },
  };
};

const renderSeek = (media: ReturnType<typeof createMockMedia> | null) => {
  const getTarget = () => (media ? (media as unknown as HTMLMediaElement) : null);
  return renderHook(() => useMediaSeek(getTarget));
};

describe('useMediaSeek', () => {
  it('sets currentTime when given a finite value', () => {
    const media = createMockMedia();
    const { result } = renderSeek(media);

    act(() => result.current.seek(5));
    expect(media.currentTime).toBe(5);

    act(() => result.current.seek(0));
    expect(media.currentTime).toBe(0);
  });

  it('ignores NaN', () => {
    const media = createMockMedia();
    media.currentTime = 2;
    const { result } = renderSeek(media);

    act(() => result.current.seek(NaN));
    expect(media.currentTime).toBe(2);
  });

  it('ignores Infinity', () => {
    const media = createMockMedia();
    media.currentTime = 2;
    const { result } = renderSeek(media);

    act(() => result.current.seek(Infinity));
    expect(media.currentTime).toBe(2);
  });

  it('ignores -Infinity', () => {
    const media = createMockMedia();
    media.currentTime = 2;
    const { result } = renderSeek(media);

    act(() => result.current.seek(-Infinity));
    expect(media.currentTime).toBe(2);
  });

  it('no-ops when target element is null', () => {
    const { result } = renderSeek(null);
    expect(() => act(() => result.current.seek(5))).not.toThrow();
  });
});
