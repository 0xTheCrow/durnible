import { style } from '@vanilla-extract/css';
import { DefaultReset, color, config, toRem } from 'folds';

export const SpotifyEmbed = style([
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

export const SpotifyIframe = style([
  DefaultReset,
  {
    width: '100%',
    height: toRem(152),
    border: 'none',
    display: 'block',
  },
]);

export const SpotifyIframeTall = style([
  DefaultReset,
  {
    width: '100%',
    height: toRem(352),
    border: 'none',
    display: 'block',
  },
]);

export const SpotifyLink = style([
  DefaultReset,
  {
    padding: config.space.S200,
  },
]);
