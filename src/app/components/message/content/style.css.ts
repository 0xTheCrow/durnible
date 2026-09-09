import { style } from '@vanilla-extract/css';
import { DefaultReset, config } from 'folds';

export const RelativeBase = style([
  DefaultReset,
  {
    position: 'relative',
    width: '100%',
    height: '100%',
  },
]);

export const AbsoluteContainer = style([
  DefaultReset,
  {
    position: 'absolute',
    top: 0,
    left: 0,
    width: '100%',
    height: '100%',
  },
]);

export const AbsoluteFooter = style([
  DefaultReset,
  {
    position: 'absolute',
    pointerEvents: 'none',
    bottom: config.space.S100,
    left: config.space.S100,
    right: config.space.S100,
  },
]);

export const UnsupportedFormatContainer = style([
  DefaultReset,
  {
    padding: config.space.S200,
  },
]);

export const UnsupportedFormatMessage = style([
  DefaultReset,
  {
    padding: config.space.S200,
    borderRadius: config.radii.R300,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    color: 'white',
  },
]);

export const Blur = style([
  DefaultReset,
  {
    filter: 'blur(44px)',
  },
]);
