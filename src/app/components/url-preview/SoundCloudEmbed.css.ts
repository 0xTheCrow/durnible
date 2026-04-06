import { style } from '@vanilla-extract/css';
import { DefaultReset, color, config, toRem } from 'folds';

export const SoundCloudEmbed = style([
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

export const SoundCloudIframe = style([
  DefaultReset,
  {
    width: '100%',
    height: toRem(166),
    border: 'none',
    display: 'block',
  },
]);

export const SoundCloudIframeTall = style([
  DefaultReset,
  {
    width: '100%',
    height: toRem(450),
    border: 'none',
    display: 'block',
  },
]);

export const SoundCloudLink = style([
  DefaultReset,
  {
    padding: config.space.S200,
  },
]);
