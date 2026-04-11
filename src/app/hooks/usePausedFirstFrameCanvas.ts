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

    const drawFrom = (source: CanvasImageSource, w: number, h: number) => {
      const c = canvasRef.current;
      if (!c) return;
      c.width = w;
      c.height = h;
      const ctx = c.getContext('2d');
      if (!ctx) return;
      try {
        ctx.drawImage(source, 0, 0);
      } catch (e) {
        console.error('[usePausedFirstFrameCanvas] drawImage threw:', e);
      }
    };

    // Environments without createImageBitmap (e.g. jsdom in tests): fall back
    // to direct drawImage from the img element.
    if (typeof createImageBitmap !== 'function') {
      drawFrom(img, img.naturalWidth, img.naturalHeight);
      return undefined;
    }

    let cancelled = false;
    let bitmap: ImageBitmap | undefined;
    let observer: IntersectionObserver | undefined;

    createImageBitmap(img)
      .then((bm) => {
        if (cancelled) {
          bm.close?.();
          return;
        }
        bitmap = bm;
        drawFrom(bm, bm.width, bm.height);

        // Firefox can discard a canvas's backing store while it's off-screen;
        // redraw from the cached bitmap on viewport re-entry to recover.
        if (typeof IntersectionObserver !== 'undefined' && canvasRef.current) {
          observer = new IntersectionObserver(
            ([entry]) => {
              if (entry.isIntersecting && bitmap) {
                drawFrom(bitmap, bitmap.width, bitmap.height);
              }
            },
            { threshold: 0 }
          );
          observer.observe(canvasRef.current);
        }
      })
      .catch((e) => {
        if (cancelled) return;
        console.error('[usePausedFirstFrameCanvas] createImageBitmap rejected:', e);
        drawFrom(img, img.naturalWidth, img.naturalHeight);
      });

    return () => {
      cancelled = true;
      observer?.disconnect();
      bitmap?.close?.();
    };
  }, [enabled, loaded, imgRef, canvasRef]);
};
