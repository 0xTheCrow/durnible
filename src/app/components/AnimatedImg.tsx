import React, { useLayoutEffect, useRef, useState } from 'react';

type AnimatedImgProps = React.ImgHTMLAttributes<HTMLImageElement> & {
  pauseGifs: boolean;
  hovered?: boolean;
};

export function AnimatedImg({ pauseGifs, hovered: hoveredProp, ...imgProps }: AnimatedImgProps) {
  const imgRef = useRef<HTMLImageElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [loaded, setLoaded] = useState(false);
  const [hoveredSelf, setHoveredSelf] = useState(false);

  const hovered = hoveredProp ?? hoveredSelf;
  const selfManaged = hoveredProp === undefined;

  useLayoutEffect(() => {
    if (!pauseGifs || !loaded || !imgRef.current || !canvasRef.current) return;
    const img = imgRef.current;
    const canvas = canvasRef.current;
    canvas.width = img.naturalWidth;
    canvas.height = img.naturalHeight;
    const ctx = canvas.getContext('2d');
    console.log('[AnimatedImg] draw effect', {
      src: img.src?.slice(0, 80),
      naturalWidth: img.naturalWidth,
      naturalHeight: img.naturalHeight,
      complete: img.complete,
      canvasW: canvas.width,
      canvasH: canvas.height,
      ctx: !!ctx,
    });
    if (ctx) {
      try {
        ctx.drawImage(img, 0, 0);
        console.log('[AnimatedImg] drawImage succeeded', img.src?.slice(0, 80));
      } catch (e) {
        console.error('[AnimatedImg] drawImage threw:', e);
      }
    }
  }, [pauseGifs, loaded]);

  if (!pauseGifs) {
    // eslint-disable-next-line jsx-a11y/alt-text
    return <img {...imgProps} data-testid="animated-img" />;
  }

  return (
    <span
      data-testid="animated-img-wrapper"
      style={{ position: 'relative', display: 'inline-flex' }}
      onMouseEnter={selfManaged ? () => setHoveredSelf(true) : undefined}
      onMouseLeave={selfManaged ? () => setHoveredSelf(false) : undefined}
    >
      {/* eslint-disable-next-line jsx-a11y/alt-text */}
      <img
        {...imgProps}
        ref={imgRef}
        data-testid="animated-img"
        style={{
          ...imgProps.style,
          visibility: loaded && !hovered ? 'hidden' : 'visible',
        }}
        onLoad={(e) => {
          const el = e.currentTarget;
          console.log('[AnimatedImg] onLoad', {
            src: el.src?.slice(0, 80),
            naturalWidth: el.naturalWidth,
            naturalHeight: el.naturalHeight,
            complete: el.complete,
          });
          setLoaded(true);
          if (imgProps.onLoad) imgProps.onLoad(e);
        }}
        onError={(e) => {
          const el = e.currentTarget;
          console.error('[AnimatedImg] onError', {
            src: el.src?.slice(0, 80),
            complete: el.complete,
            naturalWidth: el.naturalWidth,
          });
          if (imgProps.onError) imgProps.onError(e);
        }}
      />
      {loaded && (
        <canvas
          ref={canvasRef}
          data-testid="animated-img-canvas"
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%',
            pointerEvents: 'none',
            visibility: hovered ? 'hidden' : 'visible',
          }}
        />
      )}
    </span>
  );
}
