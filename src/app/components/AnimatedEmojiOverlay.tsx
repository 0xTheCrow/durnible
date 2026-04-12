import React, { useRef, useState } from 'react';
import { usePausedFirstFrameCanvas } from '../hooks/usePausedFirstFrameCanvas';

type AnimatedEmojiOverlayProps = React.ImgHTMLAttributes<HTMLImageElement> & {
  pauseGifs: boolean;
  hovered?: boolean;
};

export function AnimatedEmojiOverlay({
  pauseGifs,
  hovered: hoveredProp,
  ...imgProps
}: AnimatedEmojiOverlayProps) {
  const imgRef = useRef<HTMLImageElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [hoveredSelf, setHoveredSelf] = useState(false);

  const hovered = hoveredProp ?? hoveredSelf;
  const selfManaged = hoveredProp === undefined;

  usePausedFirstFrameCanvas(imgRef, canvasRef, loaded, pauseGifs);

  if (!pauseGifs) {
    // eslint-disable-next-line jsx-a11y/alt-text
    return <img {...imgProps} data-testid="animated-emoji-overlay" />;
  }

  return (
    <span
      data-testid="animated-emoji-overlay-wrapper"
      style={{ position: 'relative', display: 'inline-flex' }}
      onMouseEnter={selfManaged ? () => setHoveredSelf(true) : undefined}
      onMouseLeave={selfManaged ? () => setHoveredSelf(false) : undefined}
    >
      {/* eslint-disable-next-line jsx-a11y/alt-text */}
      <img
        {...imgProps}
        ref={imgRef}
        data-testid="animated-emoji-overlay"
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
          data-testid="animated-emoji-overlay-canvas"
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
