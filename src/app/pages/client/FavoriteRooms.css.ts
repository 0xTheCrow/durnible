import { createVar, style } from '@vanilla-extract/css';
import { color, config, toRem } from 'folds';

const DropLineDist = createVar();

export const FavoriteDropTarget = style({
  position: 'relative',
  vars: {
    [DropLineDist]: toRem(-2),
  },
  selectors: {
    '&[data-drop-above=true]::before, &[data-drop-below=true]::after': {
      content: '',
      display: 'block',
      position: 'absolute',
      left: 0,
      width: '100%',
      height: config.borderWidth.B700,
      backgroundColor: color.Success.Main,
      pointerEvents: 'none',
    },
    '&[data-drop-above=true]::before': {
      top: DropLineDist,
    },
    '&[data-drop-below=true]::after': {
      bottom: DropLineDist,
    },
  },
});
