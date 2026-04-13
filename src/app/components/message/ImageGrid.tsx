import React, { useCallback, useMemo, useState } from 'react';
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

// Mirrors MImage's MAX_HEIGHT.
const SINGLE_IMAGE_MAX_HEIGHT = 400;
const GRID_MIN_WIDTH = 400;
// Must match `gap` in ImageGrid.css.ts.
const GRID_GAP = 12;
const DESKTOP_LAYOUT_INSET = 412;
const DESKTOP_MIN_BUDGET = 200;
const MOBILE_MAX_WIDTH = 500;

const useBodyWidth = (): number => {
  const [width, setWidth] = useState(() => document.body.clientWidth);
  useElementSizeObserver(
    useCallback(() => document.body, []),
    useCallback((w) => setWidth(w), [])
  );
  return width;
};

const singleImageWidth = (content: ImageContent): number => {
  const w = content.info?.w || GRID_MIN_WIDTH;
  const h = content.info?.h || GRID_MIN_WIDTH;
  return h > SINGLE_IMAGE_MAX_HEIGHT ? Math.round(w * (SINGLE_IMAGE_MAX_HEIGHT / h)) : w;
};

type Count = 2 | 3 | 4 | 5 | 6;

const buildDesktopStyle = (count: Count, widthBudget: number): React.CSSProperties => {
  const gap = GRID_GAP;
  const maxHeight = SINGLE_IMAGE_MAX_HEIGHT;
  const rem = (n: number) => toRem(n);
  const repeatTrack = (n: number, size: number) => Array(n).fill(rem(size)).join(' ');

  switch (count) {
    case 2: {
      const cellSize = Math.min((widthBudget - gap) / 2, maxHeight);
      return {
        width: rem(2 * cellSize + gap),
        height: rem(cellSize),
        gridTemplateColumns: repeatTrack(2, cellSize),
        gridTemplateRows: rem(cellSize),
      };
    }
    case 3: {
      const cellSize = Math.min((widthBudget - 2 * gap) / 3, (maxHeight - gap) / 2);
      const heroSide = 2 * cellSize + gap;
      return {
        width: rem(3 * cellSize + 2 * gap),
        height: rem(heroSide),
        gridTemplateColumns: `${rem(heroSide)} ${rem(cellSize)}`,
        gridTemplateRows: repeatTrack(2, cellSize),
      };
    }
    case 4: {
      const cellSize = Math.min((widthBudget - gap) / 2, (maxHeight - gap) / 2);
      return {
        width: rem(2 * cellSize + gap),
        height: rem(2 * cellSize + gap),
        gridTemplateColumns: repeatTrack(2, cellSize),
        gridTemplateRows: repeatTrack(2, cellSize),
      };
    }
    case 5: {
      const cellSize = Math.min((widthBudget - 3 * gap) / 4, (maxHeight - gap) / 2);
      const heroSide = 2 * cellSize + gap;
      return {
        width: rem(4 * cellSize + 3 * gap),
        height: rem(heroSide),
        gridTemplateColumns: `${rem(heroSide)} ${rem(cellSize)} ${rem(cellSize)}`,
        gridTemplateRows: repeatTrack(2, cellSize),
      };
    }
    case 6: {
      const cellSize = Math.min((widthBudget - 2 * gap) / 3, (maxHeight - gap) / 2);
      return {
        width: rem(3 * cellSize + 2 * gap),
        height: rem(2 * cellSize + gap),
        gridTemplateColumns: repeatTrack(3, cellSize),
        gridTemplateRows: repeatTrack(2, cellSize),
      };
    }
    default:
      throw new Error(`Unsupported image grid count: ${count}`);
  }
};

const buildMobileStyle = (count: Count): React.CSSProperties => {
  const rowsForCount: Record<Count, number> = { 2: 1, 3: 2, 4: 2, 5: 3, 6: 3 };
  return {
    width: '100vw',
    maxWidth: `min(100%, ${toRem(MOBILE_MAX_WIDTH)})`,
    gridTemplateColumns: '1fr 1fr',
    gridTemplateRows: `repeat(${rowsForCount[count]}, auto)`,
  };
};

type ImageGridProps = {
  contents: ImageContent[];
  autoPlay?: boolean;
};

export function ImageGrid({ contents, autoPlay }: ImageGridProps) {
  const cells = contents.slice(0, 6);
  const count = cells.length as Count;
  const firstIsHero = count === 3 || count === 5;

  const isMobile = useScreenSizeContext() === ScreenSize.Mobile;
  const bodyWidth = useBodyWidth();
  let gridStyle: React.CSSProperties;
  if (isMobile) {
    gridStyle = buildMobileStyle(count);
  } else {
    const naturalBudget = Math.max(GRID_MIN_WIDTH, ...cells.map(singleImageWidth));
    const desktopBudget = Math.min(
      naturalBudget,
      Math.max(DESKTOP_MIN_BUDGET, bodyWidth - DESKTOP_LAYOUT_INSET)
    );
    gridStyle = buildDesktopStyle(count, desktopBudget);
  }

  const setViewerState = useSetAtom(imageViewerAtom);

  const galleryItems: ImageViewerGalleryItem[] = useMemo(
    () =>
      cells.map((content) => ({
        alt: content.body || 'Image',
        mxcUrl: content.file?.url ?? content.url,
        encInfo: content.file,
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
    <div className={css.ImageGrid} style={gridStyle}>
      {cells.map((content, idx) => {
        const heroCell = firstIsHero && idx === 0;
        const cellClassName = classNames(
          css.ImageGridCell,
          heroCell && (isMobile ? css.ImageGridCellSpanFullRow : css.ImageGridCellSpanFullColumn)
        );
        const mxcUrl = content.file?.url ?? content.url;
        if (typeof mxcUrl !== 'string') {
          return (
            // eslint-disable-next-line react/no-array-index-key
            <div key={idx} className={cellClassName}>
              <BrokenContent />
            </div>
          );
        }
        return (
          // eslint-disable-next-line react/no-array-index-key
          <div key={idx} className={cellClassName}>
            <ImageContentView
              body={content.body || 'Image'}
              info={content.info}
              mimeType={content.info?.mimetype}
              url={mxcUrl}
              encInfo={content.file}
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
  );
}
