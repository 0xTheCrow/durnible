import type { RefObject } from 'react';
import { useEffect, useState } from 'react';

export const checkIsFullscreenSupported = (): boolean => document.fullscreenEnabled;

export const useFullscreen = (
  targetRef: RefObject<HTMLElement>
): { isFullscreen: boolean; toggleFullscreen: () => void } => {
  const [isFullscreen, setIsFullscreen] = useState(false);

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(document.fullscreenElement === targetRef.current);
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
    };
  }, [targetRef]);

  const toggleFullscreen = () => {
    const target = targetRef.current;
    if (!target) return;
    if (document.fullscreenElement === target) {
      document.exitFullscreen().catch(() => undefined);
    } else {
      target.requestFullscreen().catch(() => undefined);
    }
  };

  return { isFullscreen, toggleFullscreen };
};
