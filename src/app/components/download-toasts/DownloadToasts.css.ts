import { style } from '@vanilla-extract/css';
import { DefaultReset, color, config, toRem } from 'folds';
import { SAFE_AREA_INSET_TOP } from '../../styles/safeArea';

export const DownloadToastStack = style([
  DefaultReset,
  {
    position: 'fixed',
    top: `calc(${SAFE_AREA_INSET_TOP} + ${config.space.S400})`,
    left: config.space.S400,
    right: config.space.S400,
    zIndex: config.zIndex.Max,
    pointerEvents: 'none',
  },
]);

export const DownloadToast = style([
  DefaultReset,
  {
    width: toRem(360),
    maxWidth: '100%',
    padding: config.space.S100,
    borderRadius: config.radii.R400,
    border: `${config.borderWidth.B300} solid ${color.Surface.ContainerLine}`,
    backgroundColor: color.Surface.Container,
    color: color.Surface.OnContainer,
    boxShadow: config.shadow.E200,
    pointerEvents: 'auto',
  },
]);

export const DownloadToastSummary = style([
  DefaultReset,
  {
    minWidth: 0,
    padding: config.space.S200,
  },
]);

export const DownloadToastReveal = style([
  DownloadToastSummary,
  {
    borderRadius: config.radii.R300,
    textAlign: 'left',
    cursor: 'pointer',
    selectors: {
      '&:hover, &:focus-visible': {
        backgroundColor: color.Surface.ContainerHover,
      },
    },
  },
]);
