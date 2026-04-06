import { style } from '@vanilla-extract/css';
import { DefaultReset, color, config, toRem } from 'folds';

export const NitterEmbed = style([
  DefaultReset,
  {
    width: toRem(400),
    maxWidth: '100%',
    backgroundColor: color.SurfaceVariant.Container,
    color: color.SurfaceVariant.OnContainer,
    border: `${config.borderWidth.B300} solid ${color.SurfaceVariant.ContainerLine}`,
    borderRadius: config.radii.R300,
    overflow: 'hidden',
  },
]);

export const NitterIframe = style([
  DefaultReset,
  {
    width: '100%',
    minHeight: toRem(200),
    maxHeight: toRem(700),
    border: 'none',
    display: 'block',
    overflowY: 'auto',
  },
]);

export const NitterLink = style([
  DefaultReset,
  {
    padding: config.space.S200,
  },
]);
