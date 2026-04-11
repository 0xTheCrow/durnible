import type { RefObject } from 'react';
import { useLayoutEffect } from 'react';

export const usePausedFirstFrameCanvas = (
  imgRef: RefObject<HTMLImageElement | null>,
  canvasRef: RefObject<HTMLCanvasElement | null>,
  loaded: boolean,
  enabled: boolean
): void => {
  useLayoutEffect(() => {
    if (!enabled || !loaded || !imgRef.current || !canvasRef.current) return;
    const img = imgRef.current;
    const canvas = canvasRef.current;
    canvas.width = img.naturalWidth;
    canvas.height = img.naturalHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    try {
      ctx.drawImage(img, 0, 0);
    } catch (e) {
      console.error('[usePausedFirstFrameCanvas] drawImage threw:', e);
    }
  }, [enabled, loaded, imgRef, canvasRef]);
};
