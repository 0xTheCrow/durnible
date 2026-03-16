import React, { useCallback, useRef, useState } from 'react';

type AnimatedImgProps = React.ImgHTMLAttributes<HTMLImageElement> & {
  pauseGifs: boolean;
  hovered?: boolean;
};

function drawFirstFrame(img: HTMLImageElement, canvas: HTMLCanvasElement): boolean {
  if (img.naturalWidth === 0 || img.naturalHeight === 0) return false;
  canvas.width = img.naturalWidth;
  canvas.height = img.naturalHeight;
  const ctx = canvas.getContext('2d');
  if (!ctx) return false;
  ctx.drawImage(img, 0, 0);
  return true;
}

export function AnimatedImg({ pauseGifs, hovered: hoveredProp, ...imgProps }: AnimatedImgProps) {
  const imgRef = useRef<HTMLImageElement | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [hoveredSelf, setHoveredSelf] = useState(false);

  const hovered = hoveredProp ?? hoveredSelf;
  const selfManaged = hoveredProp === undefined;

  // Use a callback ref so the canvas is drawn every time the element mounts
  const canvasCallbackRef = useCallback(
    (canvas: HTMLCanvasElement | null) => {
      if (!canvas || !imgRef.current) return;
      drawFirstFrame(imgRef.current, canvas);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [loaded]
  );

  if (!pauseGifs) {
    // eslint-disable-next-line jsx-a11y/alt-text
    return <img {...imgProps} />;
  }

  return (
    <span
      style={{ position: 'relative', display: 'inline-flex' }}
      onMouseEnter={selfManaged ? () => setHoveredSelf(true) : undefined}
      onMouseLeave={selfManaged ? () => setHoveredSelf(false) : undefined}
    >
      {/* eslint-disable-next-line jsx-a11y/alt-text */}
      <img
        {...imgProps}
        ref={imgRef}
        style={{
          ...imgProps.style,
          visibility: loaded && !hovered ? 'hidden' : 'visible',
        }}
        onLoad={(e) => {
          setLoaded(true);
          if (imgProps.onLoad) imgProps.onLoad(e);
        }}
      />
      {loaded && (
        <canvas
          ref={canvasCallbackRef}
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
