import React, { useCallback, useLayoutEffect, useMemo, useState } from 'react';
import { useSetAtom } from 'jotai';
import { ImageContent as ImageContentView } from './content';
import { Image } from '../media';
import * as css from './ImageGrid.css';
import type { ImageContent } from '../../../types/matrix/common';
import {
  MATRIX_SPOILER_PROPERTY_NAME,
  MATRIX_SPOILER_REASON_PROPERTY_NAME,
} from '../../../types/matrix/common';
import { BrokenContent } from './MsgTypeRenderers';
import type { ImageViewerGalleryItem } from '../../state/imageViewer';
import { imageViewerAtom } from '../../state/imageViewer';
import { ScreenSize, useScreenSizeContext } from '../../hooks/useScreenSize';
import { useElementSizeObserver } from '../../hooks/useElementSizeObserver';
import type { Count } from './imageGridLayout';
import {
  GRID_MAX_CELLS,
  GRID_MAX_HEIGHT,
  GRID_MIN_WIDTH,
  WIDE_LAYOUT_MIN_WIDTH,
  MOBILE_STACK_MAX_WIDTH,
  STACK_MAX_WIDTH,
  buildImageGridLayout,
  buildNarrowTile,
  cellAspectRatio,
  chooseImageGridLayout,
  maxHeightForCount,
} from './imageGridLayout';

const useAvailableWidth = (): [number | null, (element: HTMLDivElement | null) => void] => {
  const [container, setContainer] = useState<HTMLDivElement | null>(null);
  const [availableWidth, setAvailableWidth] = useState<number | null>(null);

  useLayoutEffect(() => {
    if (container) setAvailableWidth(container.clientWidth);
  }, [container]);

  useElementSizeObserver(
    useCallback(() => container, [container]),
    useCallback((width) => setAvailableWidth(width), [])
  );

  return [availableWidth, setContainer];
};

const FALLBACK_IMAGE_SIZE = 400;

const naturalDisplayWidth = (content: ImageContent): number => {
  const width = content.info?.w || FALLBACK_IMAGE_SIZE;
  const height = content.info?.h || FALLBACK_IMAGE_SIZE;
  return height > GRID_MAX_HEIGHT ? Math.round(width * (GRID_MAX_HEIGHT / height)) : width;
};

type ImageGridProps = {
  contents: ImageContent[];
  autoPlay?: boolean;
};

export function ImageGrid({ contents, autoPlay }: ImageGridProps) {
  const cells = contents.slice(0, GRID_MAX_CELLS);

  const isMobile = useScreenSizeContext() === ScreenSize.Mobile;
  const [availableWidth, containerRef] = useAvailableWidth();
  const isNarrowLayout =
    isMobile || availableWidth === null || availableWidth < WIDE_LAYOUT_MIN_WIDTH;

  const aspectRatios = cells.map((content) => {
    const mxcUrl = content.file?.url ?? content.url;
    if (typeof mxcUrl !== 'string') return 1;
    return cellAspectRatio(content.info?.w, content.info?.h);
  });

  const maxHeight = maxHeightForCount(cells.length as Count);

  let layout;
  if (isNarrowLayout) {
    const stackMaxWidth = isMobile ? MOBILE_STACK_MAX_WIDTH : STACK_MAX_WIDTH;
    const widthBudget = Math.min(availableWidth ?? stackMaxWidth, stackMaxWidth);
    layout = buildImageGridLayout(buildNarrowTile(aspectRatios), widthBudget, maxHeight);
  } else {
    const naturalBudget = Math.max(GRID_MIN_WIDTH, ...cells.map(naturalDisplayWidth));
    layout = chooseImageGridLayout(
      aspectRatios,
      Math.min(naturalBudget, availableWidth),
      maxHeight
    );
  }

  const setViewerState = useSetAtom(imageViewerAtom);

  const galleryItems: ImageViewerGalleryItem[] = useMemo(
    () =>
      cells.map((content) => ({
        alt: content.filename || content.body || 'Image',
        mxcUrl: content.file?.url ?? content.url,
        encryptionInfo: content.file,
        mimeType: content.info?.mimetype,
      })),
    [cells]
  );

  const handleViewCell = useCallback(
    (index: number, resolvedSrc: string, alt: string) => {
      setViewerState({
        src: resolvedSrc,
        alt,
        gallery: { items: galleryItems, index },
      });
    },
    [setViewerState, galleryItems]
  );

  return (
    <div ref={containerRef} className={css.ImageGridContainer} data-testid="image-grid-container">
      <div
        className={css.ImageGrid}
        style={{ width: `${layout.width}px`, height: `${layout.height}px` }}
        data-testid="image-grid"
      >
        {layout.cells.map((rect) => {
          const content = cells[rect.index];
          const mxcUrl = content.file?.url ?? content.url;
          const cellKey = typeof mxcUrl === 'string' ? `image-grid-cell-${mxcUrl}` : undefined;
          const cellStyle: React.CSSProperties = {
            left: `${rect.left}px`,
            top: `${rect.top}px`,
            width: `${rect.width}px`,
            height: `${rect.height}px`,
          };
          if (typeof mxcUrl !== 'string') {
            return (
              <div
                key={cellKey}
                className={css.ImageGridCell}
                style={cellStyle}
                data-testid="image-grid-cell"
              >
                <BrokenContent />
              </div>
            );
          }
          return (
            <div
              key={cellKey}
              className={css.ImageGridCell}
              style={cellStyle}
              data-testid="image-grid-cell"
            >
              <ImageContentView
                body={content.body || content.filename || 'Image'}
                filename={content.filename}
                info={content.info}
                mimeType={content.info?.mimetype}
                url={mxcUrl}
                encryptionInfo={content.file}
                autoPlay={autoPlay}
                markedAsSpoiler={content[MATRIX_SPOILER_PROPERTY_NAME]}
                spoilerReason={content[MATRIX_SPOILER_REASON_PROPERTY_NAME]}
                onView={(resolvedSrc, alt) => handleViewCell(rect.index, resolvedSrc, alt)}
                renderImage={(p) => (
                  <Image
                    {...p}
                    loading="lazy"
                    style={{
                      ...p.style,
                      width: '100%',
                      height: '100%',
                      objectFit: 'cover',
                    }}
                  />
                )}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}
