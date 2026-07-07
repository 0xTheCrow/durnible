import type { CSSProperties, ReactNode, SyntheticEvent } from 'react';
import React, { useRef, useState } from 'react';
import { usePausedFirstFrameCanvas } from '../hooks/usePausedFirstFrameCanvas';

export type AnimatedImageOverlayRenderImageProps = {
  alt: string;
  title: string;
  src: string;
  style: CSSProperties;
  onLoad: (evt: SyntheticEvent<HTMLImageElement>) => void;
  onError: () => void;
  onClick: () => void;
  tabIndex: number;
};

type AnimatedImageOverlayProps = {
  src: string;
  alt: string;
  title?: string;
  imgStyle?: CSSProperties;
  frozen?: boolean;
  hovered?: boolean;
  onLoad?: (evt: SyntheticEvent<HTMLImageElement>) => void;
  onError?: () => void;
  onView: () => void;
  renderImage: (props: AnimatedImageOverlayRenderImageProps) => ReactNode;
};

export function AnimatedImageOverlay({
  src,
  alt,
  title,
  imgStyle,
  frozen,
  hovered: hoveredProp,
  onLoad,
  onError,
  onView,
  renderImage,
}: AnimatedImageOverlayProps) {
  const imgRef = useRef<HTMLImageElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [hoveredSelf, setHoveredSelf] = useState(false);
  const selfManaged = hoveredProp === undefined;
  const hovered = !frozen && (hoveredProp ?? hoveredSelf);

  usePausedFirstFrameCanvas(imgRef, canvasRef, loaded, true);

  const handleImgLoad = (evt: SyntheticEvent<HTMLImageElement>) => {
    imgRef.current = evt.currentTarget;
    setLoaded(true);
    if (onLoad) onLoad(evt);
  };

  const handleImgError = () => {
    if (onError) onError();
  };

  return (
    <div
      data-testid="animated-image-overlay"
      role="button"
      tabIndex={0}
      aria-label={alt}
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        cursor: 'pointer',
      }}
      onMouseEnter={selfManaged && !frozen ? () => setHoveredSelf(true) : undefined}
      onMouseLeave={selfManaged && !frozen ? () => setHoveredSelf(false) : undefined}
      onClick={onView}
      onKeyDown={(evt) => {
        if (evt.key === 'Enter' || evt.key === ' ') {
          evt.preventDefault();
          onView();
        }
      }}
    >
      {renderImage({
        alt,
        title: title ?? alt,
        src,
        style: {
          ...imgStyle,
          visibility: loaded && !hovered ? 'hidden' : 'visible',
        },
        onLoad: handleImgLoad,
        onError: handleImgError,
        onClick: () => {},
        tabIndex: -1,
      })}
      {loaded && (
        <canvas
          ref={canvasRef}
          data-testid="animated-image-overlay-canvas"
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%',
            objectFit: 'contain',
            pointerEvents: 'none',
            visibility: hovered ? 'hidden' : 'visible',
          }}
        />
      )}
    </div>
  );
}
