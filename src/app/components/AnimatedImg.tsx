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
    ctx?.drawImage(img, 0, 0);
  }, [pauseGifs, loaded]);

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
          ref={canvasRef}
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
