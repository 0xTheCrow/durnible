import type { RefObject } from 'react';
import { useEffect } from 'react';

export const usePausedFirstFrameCanvas = (
  imgRef: RefObject<HTMLImageElement | null>,
  canvasRef: RefObject<HTMLCanvasElement | null>,
  loaded: boolean,
  enabled: boolean
): void => {
  useEffect(() => {
    if (!enabled || !loaded || !imgRef.current || !canvasRef.current) return undefined;
    const img = imgRef.current;

    const draw = () => {
      const c = canvasRef.current;
      if (!c) return;
      c.width = img.naturalWidth;
      c.height = img.naturalHeight;
      const ctx = c.getContext('2d');
      if (!ctx) return;
      try {
        ctx.drawImage(img, 0, 0);
      } catch {
        /* drawImage can throw on tainted/broken sources — swallow and leave the canvas blank */
      }
    };

    draw();

    // Firefox (and others) can discard a canvas's backing store while it's
    // off-screen; redraw when the canvas re-enters the viewport to recover.
    if (typeof IntersectionObserver === 'undefined') return undefined;
    const canvas = canvasRef.current;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) draw();
      },
      { threshold: 0 }
    );
    observer.observe(canvas);

    return () => observer.disconnect();
  }, [enabled, loaded, imgRef, canvasRef]);
};
