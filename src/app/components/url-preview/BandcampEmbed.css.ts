import { style } from '@vanilla-extract/css';
import { DefaultReset, color, config, toRem } from 'folds';

export const BandcampEmbed = style([
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

export const BandcampBody = style([
  DefaultReset,
  {
    padding: config.space.S300,
    display: 'flex',
    flexDirection: 'column',
    gap: config.space.S100,
  },
]);

export const BandcampLink = style([
  DefaultReset,
  {
    padding: config.space.S200,
    borderTop: `${config.borderWidth.B300} solid ${color.SurfaceVariant.ContainerLine}`,
  },
]);
