import { style } from '@vanilla-extract/css';

export const Backdrop = style({
  position: 'fixed',
  inset: 0,
  backgroundColor: 'rgba(0, 0, 0, 0.5)',
  zIndex: 100,
  transition: 'opacity 50ms ease-out',
});

export const Panel = style({
  position: 'fixed',
  top: 0,
  left: 0,
  bottom: 0,
  zIndex: 101,
  transition: 'transform 50ms ease-out',
  overflow: 'hidden',
});
