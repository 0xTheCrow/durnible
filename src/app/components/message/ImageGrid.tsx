import React, { useCallback, useMemo } from 'react';
import classNames from 'classnames';
import { useSetAtom } from 'jotai';
import { toRem } from 'folds';
import { ImageContent } from './content';
import { Image } from '../media';
import * as css from './ImageGrid.css';
import type { IImageContent } from '../../../types/matrix/common';
import {
  MATRIX_SPOILER_PROPERTY_NAME,
  MATRIX_SPOILER_REASON_PROPERTY_NAME,
} from '../../../types/matrix/common';
import { BrokenContent } from './MsgTypeRenderers';
import type { ImageViewerGalleryItem } from '../../state/imageViewer';
import { imageViewerAtom } from '../../state/imageViewer';

// Mirrors MImage: a single image has its rendered height capped at this many
// pixels. Used here to derive each member's "single-image width" so the grid
// can match the natural width a wide image would have used on its own.
const SINGLE_IMAGE_MAX_HEIGHT = 400;
// Floor for the grid width — a group of small/portrait images shouldn't
// shrink the whole grid below the default single-image footprint.
const GRID_MIN_WIDTH = 400;

const singleImageWidth = (content: IImageContent): number => {
  const w = content.info?.w || GRID_MIN_WIDTH;
  const h = content.info?.h || GRID_MIN_WIDTH;
  return h > SINGLE_IMAGE_MAX_HEIGHT ? Math.round(w * (SINGLE_IMAGE_MAX_HEIGHT / h)) : w;
};

type ImageGridProps = {
  /** Image contents in chronological order. Must contain 2-6 entries. */
  contents: IImageContent[];
  autoPlay?: boolean;
};

/**
 * Renders 2-6 image messages as a single grid (max 3 wide x 2 tall).
 *
 * Layouts:
 * - 2 → side by side
 * - 3 → image 1 spans the left column at full height, images 2 and 3 stack on the right
 * - 4 → 2x2 tiled
 * - 5 → image 1 spans the left column at full height, images 2-5 form a 2x2 sub-grid on the right
 * - 6 → 3x2 tiled
 *
 * The grid's width matches the widest single-image width across the group
 * (with a floor of GRID_MIN_WIDTH), so a group containing a wide landscape
 * has the same horizontal footprint that landscape would have alone. Cells
 * use object-fit: cover so images fill their slot uniformly.
 */
export function ImageGrid({ contents, autoPlay }: ImageGridProps) {
  // Render up to the supported max in case a caller passes more.
  const cells = contents.slice(0, 6);
  const count = cells.length as 2 | 3 | 4 | 5 | 6;
  // Odd counts (3, 5) anchor the first image in a full-height left column;
  // the remaining (even) images tile to its right.
  const firstSpansFullColumn = count === 3 || count === 5;

  const gridWidth = Math.max(GRID_MIN_WIDTH, ...cells.map(singleImageWidth));

  const setViewerState = useSetAtom(imageViewerAtom);

  // Pre-build the gallery items list once. The viewer resolves http urls
  // lazily for items the user navigates to (the clicked cell's resolved
  // src is supplied directly via onView, so the initial display is instant).
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
    <div className={css.ImageGrid({ count })} style={{ width: toRem(gridWidth) }}>
      {cells.map((content, idx) => {
        const cellClassName = classNames(
          css.ImageGridCell,
          firstSpansFullColumn && idx === 0 && css.ImageGridCellSpanFullColumn
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
            <ImageContent
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
