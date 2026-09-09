import { style } from '@vanilla-extract/css';
import { DefaultReset, color } from 'folds';
import { GRID_GAP } from './imageGridLayout';

export const ImageGridContainer = style([
  DefaultReset,
  {
    width: '100vw',
    maxWidth: '100%',
    minWidth: 0,
  },
]);

export const ImageGrid = style([
  DefaultReset,
  {
    display: 'grid',
    gap: `${GRID_GAP}px`,
    maxWidth: '100%',
    minWidth: 0,
  },
]);

export const ImageGridCell = style([
  DefaultReset,
  {
    position: 'relative',
    aspectRatio: '1',
    overflow: 'hidden',
    backgroundColor: color.SurfaceVariant.Container,
  },
]);

export const ImageGridCellSpanFullColumn = style({
  gridColumn: 1,
  gridRow: '1 / -1',
});

export const ImageGridCellSpanFullRow = style({
  gridRow: 1,
  gridColumn: '1 / -1',
});
