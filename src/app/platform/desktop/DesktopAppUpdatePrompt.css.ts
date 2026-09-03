import { style } from '@vanilla-extract/css';
import { DefaultReset, color, config, toRem } from 'folds';

export const AppUpdatePrompt = style([
  DefaultReset,
  {
    position: 'fixed',
    left: config.space.S400,
    right: config.space.S400,
    bottom: config.space.S400,
    zIndex: config.zIndex.Max,
    maxWidth: toRem(360),
    marginLeft: 'auto',
    padding: config.space.S400,
    borderRadius: config.radii.R400,
    border: `${config.borderWidth.B300} solid ${color.Surface.ContainerLine}`,
    backgroundColor: color.Surface.Container,
    color: color.Surface.OnContainer,
    boxShadow: config.shadow.E200,
  },
]);

export const AppUpdateOverlayCard = style([
  DefaultReset,
  {
    width: toRem(360),
    maxWidth: '100%',
    padding: config.space.S500,
    borderRadius: config.radii.R400,
    backgroundColor: color.Surface.Container,
    color: color.Surface.OnContainer,
    boxShadow: config.shadow.E200,
  },
]);
