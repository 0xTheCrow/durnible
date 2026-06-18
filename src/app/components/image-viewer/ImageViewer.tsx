/* eslint-disable jsx-a11y/no-noninteractive-element-interactions */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import FileSaver from 'file-saver';
import classNames from 'classnames';
import { Box, Header, Icon, Icons, Spinner, Text, as } from 'folds';
import * as css from './ImageViewer.css';
import { useZoom } from '../../hooks/useZoom';
import { usePan } from '../../hooks/usePan';
import type { Pan } from '../../hooks/usePan';
import { useTouchGesture } from '../../hooks/useTouchGesture';
import { downloadMedia } from '../../utils/matrix';
import { clampPanWithinBounds, clampZoom, panToKeepPointFixed } from '../../utils/zoom';
import type { ImageViewerGalleryItem } from '../../state/imageViewer';

export const IMAGE_VIEWER_ZOOM_STEP = 0.2;

export type ImageViewerProps = {
  alt: string;
  src: string;
  onClose: () => void;
  gallery?: {
    items: ImageViewerGalleryItem[];
    index: number;
    onNavigate: (next: { src: string; alt: string; index: number }) => void;
    resolveSrc: (item: ImageViewerGalleryItem) => Promise<string>;
  };
};

export const ImageViewer = as<'div', ImageViewerProps>(
  ({ className, alt, src, onClose, gallery, ...props }, ref) => {
    const { zoom, zoomIn, zoomOut, setZoom } = useZoom(IMAGE_VIEWER_ZOOM_STEP);

    const imgRef = useRef<HTMLImageElement>(null);
    const contentRef = useRef<HTMLDivElement>(null);

    const clampPan = useCallback((panValue: Pan, zoomLevel: number): Pan => {
      const img = imgRef.current;
      const content = contentRef.current;
      if (!img || !content) return panValue;
      return clampPanWithinBounds(
        panValue,
        zoomLevel,
        content.getBoundingClientRect(),
        img.offsetWidth,
        img.offsetHeight
      );
    }, []);

    const { pan, setPan, cursor, onMouseDown } = usePan(zoom !== 1, zoom, clampPan);

    const zoomRef = useRef(zoom);
    zoomRef.current = zoom;
    const panRef = useRef(pan);
    panRef.current = pan;

    const applyZoomAtPoint = useCallback(
      (nextZoomRaw: number, pointX: number, pointY: number) => {
        const currentZoom = zoomRef.current;
        const nextZoom = clampZoom(nextZoomRaw);
        if (nextZoom === currentZoom) return;
        const img = imgRef.current;
        const rawPan =
          nextZoom === 1 || !img
            ? { translateX: 0, translateY: 0 }
            : panToKeepPointFixed(
                img.getBoundingClientRect(),
                currentZoom,
                panRef.current,
                nextZoom,
                pointX,
                pointY
              );
        const nextPan = clampPan(rawPan, nextZoom);
        zoomRef.current = nextZoom;
        panRef.current = nextPan;
        setZoom(nextZoom);
        setPan(nextPan);
      },
      [setZoom, setPan, clampPan]
    );

    const { onTouchStart, onTouchMove, onTouchEnd } = useTouchGesture(
      zoom,
      setZoom,
      setPan,
      applyZoomAtPoint,
      clampPan
    );

    const handleWheel = useCallback(
      (evt: React.WheelEvent) => {
        evt.preventDefault();
        const step = evt.deltaY < 0 ? IMAGE_VIEWER_ZOOM_STEP : -IMAGE_VIEWER_ZOOM_STEP;
        applyZoomAtPoint(zoomRef.current + step, evt.clientX, evt.clientY);
      },
      [applyZoomAtPoint]
    );

    const resolvedSrcCacheRef = useRef<Map<number, string>>(new Map());
    if (gallery && !resolvedSrcCacheRef.current.has(gallery.index)) {
      resolvedSrcCacheRef.current.set(gallery.index, src);
    }
    const [navLoading, setNavLoading] = useState(false);
    // Used to ignore stale resolution results when the user clicks fast.
    const navRequestIdRef = useRef(0);

    const navigateTo = useCallback(
      async (targetIndex: number) => {
        if (!gallery) return;
        if (targetIndex < 0 || targetIndex >= gallery.items.length) return;
        if (targetIndex === gallery.index) return;
        const requestId = navRequestIdRef.current + 1;
        navRequestIdRef.current = requestId;

        const target = gallery.items[targetIndex];
        const cached = resolvedSrcCacheRef.current.get(targetIndex);
        if (cached) {
          gallery.onNavigate({ src: cached, alt: target.alt, index: targetIndex });
          setZoom(1);
          setPan({ translateX: 0, translateY: 0 });
          return;
        }

        setNavLoading(true);
        try {
          const resolved = await gallery.resolveSrc(target);
          if (navRequestIdRef.current !== requestId) return;
          resolvedSrcCacheRef.current.set(targetIndex, resolved);
          gallery.onNavigate({ src: resolved, alt: target.alt, index: targetIndex });
          setZoom(1);
          setPan({ translateX: 0, translateY: 0 });
        } finally {
          if (navRequestIdRef.current === requestId) {
            setNavLoading(false);
          }
        }
      },
      [gallery, setZoom, setPan]
    );

    const goPrev = useCallback(() => {
      if (gallery) navigateTo(gallery.index - 1);
    }, [gallery, navigateTo]);
    const goNext = useCallback(() => {
      if (gallery) navigateTo(gallery.index + 1);
    }, [gallery, navigateTo]);

    useEffect(() => {
      if (!gallery) return undefined;
      const handler = (evt: KeyboardEvent) => {
        if (evt.key === 'ArrowLeft') {
          evt.preventDefault();
          goPrev();
        } else if (evt.key === 'ArrowRight') {
          evt.preventDefault();
          goNext();
        }
      };
      window.addEventListener('keydown', handler);
      return () => window.removeEventListener('keydown', handler);
    }, [gallery, goPrev, goNext]);

    const hasPrev = !!gallery && gallery.index > 0;
    const hasNext = !!gallery && gallery.index < gallery.items.length - 1;

    const lastClickRef = useRef<{ time: number; x: number; y: number } | null>(null);
    const lastPointerTypeRef = useRef<string>('mouse');
    const handleClick = useCallback(
      (evt: React.MouseEvent) => {
        // Ignore the compatibility click synthesized from a touch tap; touch double-tap is handled by useTouchGesture.
        if (lastPointerTypeRef.current === 'touch') return;
        const now = Date.now();
        const last = lastClickRef.current;
        if (
          last &&
          now - last.time < 500 &&
          Math.hypot(evt.clientX - last.x, evt.clientY - last.y) < 10
        ) {
          lastClickRef.current = null;
          applyZoomAtPoint(zoom === 1 ? 2 : 1, evt.clientX, evt.clientY);
        } else {
          lastClickRef.current = { time: now, x: evt.clientX, y: evt.clientY };
        }
      },
      [zoom, applyZoomAtPoint]
    );

    const handleDownload = async () => {
      const fileContent = await downloadMedia(src);
      FileSaver.saveAs(fileContent, alt);
    };

    const inGallery = !!gallery && gallery.items.length > 1;

    return (
      <Box
        className={classNames(
          css.ImageViewer,
          zoom > 1 && css.ImageViewerExpanded,
          inGallery && css.ImageViewerGalleryMode,
          className
        )}
        direction="Column"
        {...props}
        ref={ref}
      >
        <Header className={css.ImageViewerHeader} size="500">
          <button
            type="button"
            data-testid="image-viewer-close-btn"
            className={css.ImageViewerCloseButton}
            onClick={onClose}
            aria-label="Close"
          >
            <Icon size="200" src={Icons.ArrowLeft} />
          </button>
          <Box grow="Yes" alignItems="Center" gap="300">
            <Text size="T400" truncate data-testid="image-viewer-alt">
              {alt}
            </Text>
          </Box>
          <div className={css.ImageViewerZoomGroup}>
            <button
              type="button"
              data-testid="image-viewer-zoom-out"
              className={css.ImageViewerZoomButton}
              onClick={zoomOut}
              aria-label="Zoom Out"
            >
              <Icon size="100" src={Icons.Minus} />
            </button>
            <button
              type="button"
              data-testid="image-viewer-zoom-chip"
              className={css.ImageViewerZoomChip}
              onClick={() => setZoom(zoom === 1 ? 2 : 1)}
            >
              <Text size="B300" data-testid="image-viewer-zoom-label">
                {Math.round(zoom * 100)}%
              </Text>
            </button>
            <button
              type="button"
              data-testid="image-viewer-zoom-in"
              className={css.ImageViewerZoomButton}
              onClick={zoomIn}
              aria-label="Zoom In"
            >
              <Icon size="100" src={Icons.Plus} />
            </button>
          </div>
          <button
            type="button"
            data-testid="image-viewer-download-btn"
            className={css.ImageViewerDownloadButton}
            onClick={handleDownload}
            aria-label="Download"
          >
            <Icon size="100" src={Icons.Download} />
            <Text size="B300" as="span">
              Download
            </Text>
          </button>
        </Header>
        {/* eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions */}
        <Box
          ref={contentRef}
          grow="Yes"
          className={css.ImageViewerContent}
          justifyContent="Center"
          alignItems="Center"
          style={{ cursor, touchAction: 'none' }}
          onWheel={handleWheel}
          onPointerDown={(evt) => {
            lastPointerTypeRef.current = evt.pointerType;
          }}
          onMouseDown={(evt) => {
            evt.preventDefault();
            onMouseDown(evt);
          }}
          onClick={handleClick}
          onTouchStart={onTouchStart}
          onTouchMove={onTouchMove}
          onTouchEnd={onTouchEnd}
        >
          {inGallery && (
            <>
              <button
                type="button"
                className={classNames(css.ImageViewerNavButton, css.ImageViewerNavButtonPrev)}
                onClick={(evt) => {
                  evt.stopPropagation();
                  goPrev();
                }}
                disabled={!hasPrev || navLoading}
                aria-label="Previous image"
              >
                <Icon size="300" src={Icons.ArrowLeft} />
              </button>
              <button
                type="button"
                className={classNames(css.ImageViewerNavButton, css.ImageViewerNavButtonNext)}
                onClick={(evt) => {
                  evt.stopPropagation();
                  goNext();
                }}
                disabled={!hasNext || navLoading}
                aria-label="Next image"
              >
                <Icon size="300" src={Icons.ArrowRight} />
              </button>
            </>
          )}
          <img
            ref={imgRef}
            data-testid="image-viewer-img"
            className={classNames(css.ImageViewerImg, inGallery && css.ImageViewerImgGallery)}
            style={{
              transform: `scale(${zoom}) translate(${pan.translateX}px, ${pan.translateY}px)`,
            }}
            src={src}
            alt={alt}
            draggable={false}
          />
          {navLoading && (
            <div className={css.ImageViewerLoadingOverlay}>
              <Spinner variant="Secondary" />
            </div>
          )}
        </Box>
      </Box>
    );
  }
);
