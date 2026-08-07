import { style, styleVariants } from '@vanilla-extract/css';
import { color, config, toRem } from 'folds';

const paneBorder = `${config.borderWidth.B300} solid ${color.Surface.ContainerLine}`;

export const CallPane = style({
  position: 'relative',
  display: 'grid',
  gridTemplateRows: 'auto minmax(0, 1fr) auto',
  flexShrink: 0,
  minWidth: 0,
  minHeight: 0,
  overflow: 'hidden',
  backgroundColor: color.Surface.Container,
  selectors: {
    '&:fullscreen': {
      width: '100%',
      height: '100%',
    },
  },
});

export const CallPaneDockBorder = styleVariants({
  Left: { borderRight: paneBorder },
  Right: { borderLeft: paneBorder },
  Top: { borderBottom: paneBorder },
  Bottom: { borderTop: paneBorder },
});

export const CallPaneResizeHandle = style({
  position: 'absolute',
  zIndex: 1,
  padding: 0,
  border: 'none',
  backgroundColor: 'transparent',
  transitionProperty: 'background-color',
  transitionDuration: '100ms',
  selectors: {
    '&:hover, &[data-resizing="true"]': {
      backgroundColor: color.Primary.Main,
    },
  },
});

export const CallPaneResizeHandleSide = style({
  top: 0,
  bottom: 0,
  width: toRem(6),
  cursor: 'col-resize',
});

export const CallPaneResizeHandleHorizontal = style({
  left: 0,
  right: 0,
  height: toRem(6),
  cursor: 'row-resize',
});

export const CallPaneResizeHandleEdge = styleVariants({
  Left: { right: 0 },
  Right: { left: 0 },
  Top: { bottom: 0 },
  Bottom: { top: 0 },
});

export const CallPaneHeader = style({
  gap: config.space.S200,
  padding: `0 ${config.space.S200} 0 ${config.space.S300}`,
  borderBottom: paneBorder,
});

export const CallPaneHeaderDraggable = style({
  cursor: 'grab',
});

export const CallPaneDockZoneOverlay = style({
  position: 'fixed',
  inset: 0,
  zIndex: config.zIndex.Max,
  display: 'grid',
  gridTemplateColumns: '25% 1fr 25%',
  gridTemplateRows: '1fr 1fr',
  padding: config.space.S200,
  gap: config.space.S200,
});

export const CallPaneDockZoneArea = styleVariants({
  Left: { gridColumn: '1', gridRow: '1 / span 2' },
  Right: { gridColumn: '3', gridRow: '1 / span 2' },
  Top: { gridColumn: '2', gridRow: '1' },
  Bottom: { gridColumn: '2', gridRow: '2' },
});

export const CallPaneDockZone = style({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  borderRadius: config.radii.R400,
  border: `${config.borderWidth.B500} dashed ${color.Surface.ContainerLine}`,
  backgroundColor: color.Surface.Container,
  opacity: 0.75,
});

export const CallPaneDockZoneActive = style({
  borderColor: color.Primary.Main,
  backgroundColor: color.Primary.Container,
  color: color.Primary.OnContainer,
  opacity: 1,
});

export const CallGridLayout = style({
  display: 'grid',
  gridTemplateRows: 'minmax(0, 1fr)',
  padding: config.space.S200,
  minWidth: 0,
  minHeight: 0,
});

export const CallTileGridArea = style({
  display: 'grid',
  gridTemplateRows: 'minmax(0, 1fr) auto',
  minWidth: 0,
  minHeight: 0,
});

export const CallTileGrid = style({
  display: 'grid',
  justifyContent: 'center',
  alignContent: 'center',
  minWidth: 0,
  minHeight: 0,
});

export const CallOverflowRow = style({
  paddingTop: config.space.S100,
});

export const CallOverflowParticipant = style({
  maxWidth: toRem(160),
  padding: `${config.space.S100} ${config.space.S200}`,
  borderRadius: config.radii.Pill,
  border: `${config.borderWidth.B300} solid transparent`,
  backgroundColor: color.SurfaceVariant.Container,
  color: color.SurfaceVariant.OnContainer,
});

export const CallOverflowParticipantSpeaking = style({
  borderColor: color.Success.Main,
});

export const CallSpotlightLayout = style({
  display: 'grid',
  gridTemplateRows: 'minmax(0, 1fr) auto',
  gap: config.space.S200,
  padding: config.space.S200,
  minWidth: 0,
  minHeight: 0,
});

export const CallSpotlight = style({
  position: 'relative',
  minWidth: 0,
  minHeight: 0,
});

export const CallTileStrip = style({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: config.space.S200,
});

export const CallTile = style({
  position: 'relative',
  overflow: 'hidden',
  borderRadius: config.radii.R400,
  backgroundColor: color.SurfaceVariant.Container,
  border: `${config.borderWidth.B500} solid transparent`,
});

export const CallGridTile = style({
  minWidth: 0,
  minHeight: 0,
});

export const CallStripTile = style({
  flex: '0 0 auto',
  width: toRem(128),
  height: toRem(72),
});

export const CallSpotlightTile = style({
  position: 'absolute',
  inset: 0,
});

export const CallTileInteractive = style({
  padding: 0,
  font: 'inherit',
  color: 'inherit',
  cursor: 'pointer',
});

export const CallTileSpeaking = style({
  borderColor: color.Success.Main,
});

export const CallTileFocused = style({
  borderColor: color.Primary.Main,
});

export const CallTileVideo = style({
  position: 'absolute',
  inset: 0,
  width: '100%',
  height: '100%',
});

export const CallTileVideoCover = style({
  objectFit: 'cover',
});

export const CallTileVideoContain = style({
  objectFit: 'contain',
});

export const CallTileVideoMirrored = style({
  transform: 'scaleX(-1)',
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
