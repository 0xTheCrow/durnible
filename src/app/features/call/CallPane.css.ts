import { style } from '@vanilla-extract/css';
import { color, config, toRem } from 'folds';

export const CallPane = style({
  flexBasis: 0,
  flexGrow: 1,
  minWidth: toRem(280),
  maxWidth: toRem(640),
  backgroundColor: color.Surface.Container,
  borderRight: `${config.borderWidth.B300} solid ${color.Surface.ContainerLine}`,
});

export const CallPaneStacked = style({
  flexGrow: 0,
  flexShrink: 0,
  height: '35vh',
  minWidth: 'unset',
  maxWidth: 'unset',
  borderRight: 'none',
  borderBottom: `${config.borderWidth.B300} solid ${color.Surface.ContainerLine}`,
});

export const CallPaneHeader = style({
  padding: `${config.space.S200} ${config.space.S300}`,
  borderBottom: `${config.borderWidth.B300} solid ${color.Surface.ContainerLine}`,
});

export const CallTileGrid = style({
  display: 'grid',
  gridTemplateColumns: `repeat(auto-fit, minmax(${toRem(140)}, 1fr))`,
  gap: config.space.S200,
  padding: config.space.S200,
  alignContent: 'start',
});

export const CallTile = style({
  position: 'relative',
  aspectRatio: '4 / 3',
  overflow: 'hidden',
  borderRadius: config.radii.R400,
  backgroundColor: color.SurfaceVariant.Container,
  border: `${config.borderWidth.B500} solid transparent`,
});

export const CallTileSpeaking = style({
  borderColor: color.Success.Main,
});

export const CallTileVideo = style({
  width: '100%',
  height: '100%',
  objectFit: 'cover',
});

export const CallTileName = style({
  position: 'absolute',
  left: config.space.S200,
  right: config.space.S200,
  bottom: config.space.S100,
  color: color.SurfaceVariant.OnContainer,
});

export const CallPaneControls = style({
  padding: config.space.S200,
  borderTop: `${config.borderWidth.B300} solid ${color.Surface.ContainerLine}`,
});
