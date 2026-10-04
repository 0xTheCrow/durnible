import { style } from '@vanilla-extract/css';
import { config } from 'folds';

export const CallPopOut = style({
  position: 'fixed',
  inset: 0,
  backgroundColor: 'black',
  userSelect: 'none',
});

export const CallPopOutVideo = style({
  width: '100%',
  height: '100%',
  objectFit: 'contain',
});

export const CallPopOutBar = style({
  position: 'absolute',
  top: 0,
  left: 0,
  right: 0,
  display: 'flex',
  alignItems: 'center',
  gap: config.space.S200,
  padding: `${config.space.S200} ${config.space.S200} ${config.space.S200} ${config.space.S400}`,
  background: 'linear-gradient(rgba(0, 0, 0, 0.7), transparent)',
  color: 'white',
  opacity: 0,
  transition: 'opacity 100ms ease',
  selectors: {
    [`${CallPopOut}:hover &, ${CallPopOut}:focus-within &`]: {
      opacity: 1,
    },
  },
});

export const CallPopOutCloseButton = style({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  padding: config.space.S200,
  border: 'none',
  borderRadius: config.radii.Pill,
  backgroundColor: 'transparent',
  color: 'white',
  cursor: 'pointer',
  selectors: {
    '&:hover': {
      backgroundColor: 'rgba(255, 255, 255, 0.2)',
    },
  },
});
