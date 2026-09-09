import { style } from '@vanilla-extract/css';
import { DefaultReset, color } from 'folds';

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
    position: 'relative',
    maxWidth: '100%',
    minWidth: 0,
  },
]);

export const ImageGridCell = style([
  DefaultReset,
  {
    position: 'absolute',
    overflow: 'hidden',
    backgroundColor: color.SurfaceVariant.Container,
  },
]);
