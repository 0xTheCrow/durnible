import { style } from '@vanilla-extract/css';
import { DefaultReset, color, toRem } from 'folds';

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
    gap: toRem(12),
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
