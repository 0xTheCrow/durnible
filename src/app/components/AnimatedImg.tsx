import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';

type AnimatedImgProps = React.ImgHTMLAttributes<HTMLImageElement> & {
  pauseGifs: boolean;
  hovered?: boolean;
};

let instanceCounter = 0;
let canvasCounter = 0;

// DIAGNOSTIC: build a short, human-readable tag for a given img. Matrix emoji URLs
// all share the same /_matrix/client/v1/media/download/{server}/ prefix, so slicing
// the src head produces indistinguishable log lines. Prefer the `alt` attribute
// (which for Matrix emoticons is typically the shortcode like `:blobcat:`), fall
// back to the last path segment of the src, then to "?".
const describeImg = (alt: string | undefined, src: string | undefined): string => {
  if (alt) return alt;
  if (!src) return '?';
  const noQuery = src.split('?')[0];
  const tail = noQuery.substring(noQuery.lastIndexOf('/') + 1);
  return tail || '?';
};

export function AnimatedImg({ pauseGifs, hovered: hoveredProp, ...imgProps }: AnimatedImgProps) {
  const imgRef = useRef<HTMLImageElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [hoveredSelf, setHoveredSelf] = useState(false);

  const hovered = hoveredProp ?? hoveredSelf;
  const selfManaged = hoveredProp === undefined;

  // DIAGNOSTIC: stable per-instance id. If the bug produces multiple "mount"
  // logs for the same label, React is remounting us and that's the root cause;
  // if it produces only one mount but multiple "canvas attached" ids, React is
  // swapping the canvas element underneath us.
  const instanceIdRef = useRef<number>(0);
  if (instanceIdRef.current === 0) {
    instanceCounter += 1;
    instanceIdRef.current = instanceCounter;
  }
  const instanceId = instanceIdRef.current;

  const label = describeImg(imgProps.alt, imgProps.src?.toString());

  // DIAGNOSTIC: track the canvas element identity via a callback ref.
  const canvasIdRef = useRef<number>(0);
  const setCanvasRef = (el: HTMLCanvasElement | null) => {
    if (el && el !== canvasRef.current) {
      canvasCounter += 1;
      canvasIdRef.current = canvasCounter;
      console.log('[AnimatedImg] canvas attached', {
        label,
        instance: instanceId,
        canvas: canvasCounter,
      });
    }
    canvasRef.current = el;
  };

  useEffect(() => {
    console.log('[AnimatedImg] mount', { label, instance: instanceId });
    return () => console.log('[AnimatedImg] unmount', { label, instance: instanceId });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useLayoutEffect(() => {
    if (!pauseGifs || !loaded || !imgRef.current || !canvasRef.current) return undefined;
    const img = imgRef.current;
    const canvas = canvasRef.current;
    canvas.width = img.naturalWidth;
    canvas.height = img.naturalHeight;
    const ctx = canvas.getContext('2d');
    console.log('[AnimatedImg] draw effect', {
      label,
      instance: instanceId,
      canvas: canvasIdRef.current,
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
        console.log('[AnimatedImg] drawImage #1 returned', { label, instance: instanceId });
      } catch (e) {
        console.error('[AnimatedImg] drawImage #1 threw:', { label, instance: instanceId, e });
      }

      // DIAGNOSTIC & potential fix: retry the draw one animation frame later.
      // If this turns the blank emojis visible, the bug is a transient/timing
      // issue at mount time and the fix is to always redraw after a rAF. If it
      // does NOT fix it, the draw is being undone after the fact, or the second
      // draw is also being silently no-op'd — that rules out "initial draw raced
      // decode" and points at backing-store eviction or a silent drawImage no-op.
      const rafId = requestAnimationFrame(() => {
        const img2 = imgRef.current;
        const canvas2 = canvasRef.current;
        if (!img2 || !canvas2) return;
        const ctx2 = canvas2.getContext('2d');
        if (!ctx2) return;
        try {
          ctx2.drawImage(img2, 0, 0);
          console.log('[AnimatedImg] drawImage #2 (rAF) returned', {
            label,
            instance: instanceId,
            canvas: canvasIdRef.current,
            canvasW: canvas2.width,
            canvasH: canvas2.height,
          });
        } catch (e) {
          console.error('[AnimatedImg] drawImage #2 threw:', { label, instance: instanceId, e });
        }
      });
      return () => cancelAnimationFrame(rafId);
    }
    return undefined;
  }, [pauseGifs, loaded, instanceId, label]);

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
            label,
            instance: instanceId,
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
            label,
            instance: instanceId,
            complete: el.complete,
            naturalWidth: el.naturalWidth,
          });
          if (imgProps.onError) imgProps.onError(e);
        }}
      />
      {loaded && (
        <canvas
          ref={setCanvasRef}
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
