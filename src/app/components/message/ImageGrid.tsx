import React, { useCallback, useLayoutEffect, useMemo, useState } from 'react';
import classNames from 'classnames';
import { useSetAtom } from 'jotai';
import { toRem } from 'folds';
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
  GRID_GAP,
  GRID_MAX_CELLS,
  GRID_MIN_WIDTH,
  MOBILE_STACK_MAX_WIDTH,
  SINGLE_IMAGE_MAX_HEIGHT,
  STACK_MAX_WIDTH,
  gridColumnsForCount,
  stackColumnsForCount,
  stackRowsForCount,
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

const singleImageWidth = (content: ImageContent): number => {
  const w = content.info?.w || GRID_MIN_WIDTH;
  const h = content.info?.h || GRID_MIN_WIDTH;
  return h > SINGLE_IMAGE_MAX_HEIGHT ? Math.round(w * (SINGLE_IMAGE_MAX_HEIGHT / h)) : w;
};

const buildDesktopStyle = (count: Count, widthBudget: number): React.CSSProperties => {
  const gap = GRID_GAP;
  const maxHeight = SINGLE_IMAGE_MAX_HEIGHT;
  const columns = gridColumnsForCount[count];
  const rem = (n: number) => toRem(n);
  const repeatTrack = (n: number, size: number) => Array(n).fill(rem(size)).join(' ');

  switch (count) {
    case 2: {
      const cellSize = Math.min((widthBudget - gap) / 2, maxHeight);
      return {
        width: rem(2 * cellSize + gap),
        height: rem(cellSize),
        gridTemplateColumns: repeatTrack(columns, cellSize),
        gridTemplateRows: rem(cellSize),
      };
    }
    case 3: {
      const cellSize = Math.min((widthBudget - 2 * gap) / 3, (maxHeight - gap) / 2);
      const heroSide = 2 * cellSize + gap;
      return {
        width: rem(3 * cellSize + 2 * gap),
        height: rem(heroSide),
        gridTemplateColumns: `${rem(heroSide)} ${repeatTrack(columns - 1, cellSize)}`,
        gridTemplateRows: repeatTrack(2, cellSize),
      };
    }
    case 4: {
      const cellSize = Math.min((widthBudget - gap) / 2, (maxHeight - gap) / 2);
      return {
        width: rem(2 * cellSize + gap),
        height: rem(2 * cellSize + gap),
        gridTemplateColumns: repeatTrack(columns, cellSize),
        gridTemplateRows: repeatTrack(2, cellSize),
      };
    }
    case 5: {
      const cellSize = Math.min((widthBudget - 3 * gap) / 4, (maxHeight - gap) / 2);
      const heroSide = 2 * cellSize + gap;
      return {
        width: rem(4 * cellSize + 3 * gap),
        height: rem(heroSide),
        gridTemplateColumns: `${rem(heroSide)} ${repeatTrack(columns - 1, cellSize)}`,
        gridTemplateRows: repeatTrack(2, cellSize),
      };
    }
    case 6: {
      const cellSize = Math.min((widthBudget - 2 * gap) / 3, (maxHeight - gap) / 2);
      return {
        width: rem(3 * cellSize + 2 * gap),
        height: rem(2 * cellSize + gap),
        gridTemplateColumns: repeatTrack(columns, cellSize),
        gridTemplateRows: repeatTrack(2, cellSize),
      };
    }
    default:
      throw new Error(`Unsupported image grid count: ${count}`);
  }
};

const buildStackStyle = (count: Count, maxWidth: number): React.CSSProperties => ({
  width: '100%',
  maxWidth: toRem(maxWidth),
  gridTemplateColumns: `repeat(${stackColumnsForCount[count]}, 1fr)`,
  gridTemplateRows: `repeat(${stackRowsForCount[count]}, auto)`,
});

type ImageGridProps = {
  contents: ImageContent[];
  autoPlay?: boolean;
};

export function ImageGrid({ contents, autoPlay }: ImageGridProps) {
  const cells = contents.slice(0, GRID_MAX_CELLS);
  const count = cells.length as Count;
  const firstIsHero = count === 3 || count === 5;

  const isMobile = useScreenSizeContext() === ScreenSize.Mobile;
  const [availableWidth, containerRef] = useAvailableWidth();
  const isStackLayout = isMobile || availableWidth === null || availableWidth < GRID_MIN_WIDTH;

  let gridStyle: React.CSSProperties;
  if (isStackLayout) {
    gridStyle = buildStackStyle(count, isMobile ? MOBILE_STACK_MAX_WIDTH : STACK_MAX_WIDTH);
  } else {
    const naturalBudget = Math.max(GRID_MIN_WIDTH, ...cells.map(singleImageWidth));
    gridStyle = buildDesktopStyle(count, Math.min(naturalBudget, availableWidth));
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
      <div className={css.ImageGrid} style={gridStyle} data-testid="image-grid">
        {cells.map((content, idx) => {
          const heroCell = firstIsHero && idx === 0;
          const cellClassName = classNames(
            css.ImageGridCell,
            heroCell &&
              (isStackLayout ? css.ImageGridCellSpanFullRow : css.ImageGridCellSpanFullColumn)
          );
          const mxcUrl = content.file?.url ?? content.url;
          const cellKey = typeof mxcUrl === 'string' ? `image-grid-cell-${mxcUrl}` : undefined;
          if (typeof mxcUrl !== 'string') {
            return (
              <div key={cellKey} className={cellClassName} data-testid="image-grid-cell">
                <BrokenContent />
              </div>
            );
          }
          return (
            <div key={cellKey} className={cellClassName} data-testid="image-grid-cell">
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
                onView={(resolvedSrc, alt) => handleViewCell(idx, resolvedSrc, alt)}
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
