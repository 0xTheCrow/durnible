import { style } from '@vanilla-extract/css';
import { DefaultReset, color, config, toRem } from 'folds';

export const YouTubeEmbed = style([
  DefaultReset,
  {
    width: toRem(400),
    backgroundColor: color.SurfaceVariant.Container,
    color: color.SurfaceVariant.OnContainer,
    border: `${config.borderWidth.B300} solid ${color.SurfaceVariant.ContainerLine}`,
    borderRadius: config.radii.R300,
    overflow: 'hidden',
  },
]);

export const YouTubeIframeContainer = style([
  DefaultReset,
  {
    position: 'relative',
    width: '100%',
    paddingTop: '56.25%',
  },
]);

export const YouTubeIframe = style([
  DefaultReset,
  {
    position: 'absolute',
    top: 0,
    left: 0,
    width: '100%',
    height: '100%',
    border: 'none',
  },
]);

export const YouTubeThumbnail = style([
  DefaultReset,
  {
    position: 'absolute',
    top: 0,
    left: 0,
    width: '100%',
    height: '100%',
    objectFit: 'cover',
    cursor: 'pointer',
  },
]);

export const YouTubePlayButton = style([
  DefaultReset,
  {
    position: 'absolute',
    top: '50%',
    left: '50%',
    transform: 'translate(-50%, -50%)',
    cursor: 'pointer',
    pointerEvents: 'none',
  },
]);

export const YouTubeLink = style([
  DefaultReset,
  {
    padding: config.space.S200,
  },
]);
