/* eslint-disable jsx-a11y/no-noninteractive-element-interactions */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import FileSaver from 'file-saver';
import classNames from 'classnames';
import { Box, Header, Icon, Icons, Spinner, Text, as } from 'folds';
import * as css from './ImageViewer.css';
import { useZoom } from '../../hooks/useZoom';
import { usePan } from '../../hooks/usePan';
import { useTouchGesture } from '../../hooks/useTouchGesture';
import { downloadMedia } from '../../utils/matrix';
import type { ImageViewerGalleryItem } from '../../state/imageViewer';

export const IMAGE_VIEWER_ZOOM_STEP = 0.2;

export type ImageViewerProps = {
  alt: string;
  src: string;
  requestClose: () => void;
  /**
   * When set, enables gallery navigation. The viewer renders prev/next
   * controls (and binds arrow keys), and on navigation calls `resolveSrc`
   * for items that haven't been loaded yet, then `onNavigate` with the
   * resolved src/alt and the new index.
   *
   * Resolution lives outside the viewer so this component stays free of
   * matrix-client dependencies (and existing tests don't need a provider).
   */
  gallery?: {
    items: ImageViewerGalleryItem[];
    index: number;
    onNavigate: (next: { src: string; alt: string; index: number }) => void;
    resolveSrc: (item: ImageViewerGalleryItem) => Promise<string>;
  };
};

export const ImageViewer = as<'div', ImageViewerProps>(
  ({ className, alt, src, requestClose, gallery, ...props }, ref) => {
    const { zoom, zoomIn, zoomOut, setZoom, onWheel } = useZoom(IMAGE_VIEWER_ZOOM_STEP);
    const { pan, setPan, cursor, onMouseDown } = usePan(zoom !== 1, zoom);
    const { onTouchStart, onTouchMove, onTouchEnd } = useTouchGesture(setZoom, setPan);

    // Cache of resolved http srcs by gallery index. The first item is seeded
    // with the src the viewer was opened on; the rest are filled in lazily as
    // the user navigates.
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
    const handleClick = useCallback(
      (evt: React.MouseEvent) => {
        const now = Date.now();
        const last = lastClickRef.current;
        if (
          last &&
          now - last.time < 500 &&
          Math.hypot(evt.clientX - last.x, evt.clientY - last.y) < 10
        ) {
          lastClickRef.current = null;
          if (zoom === 1) {
            setZoom(2);
          } else {
            setZoom(1);
            setPan({ translateX: 0, translateY: 0 });
          }
        } else {
          lastClickRef.current = { time: now, x: evt.clientX, y: evt.clientY };
        }
      },
      [zoom, setZoom, setPan]
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
            onClick={requestClose}
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
        <Box
          grow="Yes"
          className={css.ImageViewerContent}
          justifyContent="Center"
          alignItems="Center"
          onWheel={onWheel}
        >
          {inGallery && (
            <>
              <button
                type="button"
                className={classNames(css.ImageViewerNavButton, css.ImageViewerNavButtonPrev)}
                onClick={goPrev}
                disabled={!hasPrev || navLoading}
                aria-label="Previous image"
              >
                <Icon size="300" src={Icons.ArrowLeft} />
              </button>
              <button
                type="button"
                className={classNames(css.ImageViewerNavButton, css.ImageViewerNavButtonNext)}
                onClick={goNext}
                disabled={!hasNext || navLoading}
                aria-label="Next image"
              >
                <Icon size="300" src={Icons.ArrowRight} />
              </button>
            </>
          )}
          {/* Pointer-driven gesture surface (drag-to-pan, double-click to
              zoom). Modal-level Escape handling closes the viewer; there is
              no meaningful keyboard equivalent for "click on image to zoom". */}
          {/* eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-noninteractive-element-interactions */}
          <img
            data-testid="image-viewer-img"
            className={classNames(css.ImageViewerImg, inGallery && css.ImageViewerImgGallery)}
            style={{
              cursor,
              transform: `scale(${zoom}) translate(${pan.translateX}px, ${pan.translateY}px)`,
            }}
            src={src}
            alt={alt}
            draggable={false}
            onMouseDown={(evt) => {
              evt.preventDefault();
              onMouseDown(evt);
            }}
            onClick={handleClick}
            onTouchStart={onTouchStart}
            onTouchMove={onTouchMove}
            onTouchEnd={onTouchEnd}
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
