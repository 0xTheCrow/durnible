import { style, styleVariants } from '@vanilla-extract/css';
import { color, toRem } from 'folds';

export const PaneResizeHandle = style({
  position: 'absolute',
  zIndex: 1,
  padding: 0,
  border: 'none',
  backgroundColor: 'transparent',
  transitionProperty: 'background-color',
  transitionDuration: '100ms',
  selectors: {
    '&:hover, &[data-resizing="true"]': {
      backgroundColor: color.Primary.Main,
    },
  },
});

export const PaneResizeHandleSide = style({
  top: 0,
  bottom: 0,
  width: toRem(6),
  cursor: 'col-resize',
});

export const PaneResizeHandleHorizontal = style({
  left: 0,
  right: 0,
  height: toRem(6),
  cursor: 'row-resize',
});

export const PaneResizeHandleAnchor = styleVariants({
  Left: { right: 0 },
  Right: { left: 0 },
  Top: { bottom: 0 },
  Bottom: { top: 0 },
});
