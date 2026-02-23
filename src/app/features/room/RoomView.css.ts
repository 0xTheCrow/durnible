import { style } from '@vanilla-extract/css';
import { color, toRem } from 'folds';

export const MobileFixedInputBar = style({
  '@media': {
    'screen and (max-width: 750px)': {
      position: 'fixed',
      bottom: 'var(--cinny-keyboard-height, 0px)',
      left: 0,
      right: 0,
      zIndex: 10,
      backgroundColor: color.Surface.Container,
    },
  },
});
