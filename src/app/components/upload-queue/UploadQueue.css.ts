import { style } from '@vanilla-extract/css';
import { DefaultReset, color, config, toRem } from 'folds';

export const UploadQueue = style([
  DefaultReset,
  {
    display: 'flex',
    gap: config.space.S200,
    overflowX: 'auto',
    padding: config.space.S300,
    borderBottom: `${config.borderWidth.B300} solid ${color.SurfaceVariant.ContainerLine}`,
  },
]);

export const UploadQueueClearAll = style({
  flex: `0 0 ${toRem(144)}`,
  width: toRem(144),
  height: toRem(144),
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  gap: config.space.S200,
  borderRadius: config.radii.R400,
  backgroundColor: color.Surface.Container,
  color: color.Surface.OnContainer,
  cursor: 'pointer',
  border: 'none',
  padding: 0,
  selectors: {
    '&:hover, &:focus-visible': {
      backgroundColor: color.Critical.Container,
      color: color.Critical.OnContainer,
    },
  },
});

export const UploadQueueStatusIcons = style({
  position: 'absolute',
  top: config.space.S100,
  left: config.space.S100,
  display: 'flex',
  gap: config.space.S100,
  alignItems: 'center',
  zIndex: 1,
});

export const UploadQueueCard = style({
  flex: `0 0 ${toRem(144)}`,
  width: toRem(144),
  display: 'flex',
  flexDirection: 'column',
  gap: config.space.S200,
});

export const UploadQueueThumbnail = style({
  position: 'relative',
  width: toRem(144),
  height: toRem(144),
  borderRadius: config.radii.R400,
  backgroundColor: color.Surface.Container,
  color: color.Surface.OnContainer,
  overflow: 'hidden',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
});

export const UploadQueueThumbnailMedia = style({
  width: '100%',
  height: '100%',
  objectFit: 'cover',
});

export const UploadQueueActions = style({
  position: 'absolute',
  top: config.space.S100,
  right: config.space.S100,
  display: 'flex',
  gap: config.space.S100,
  padding: config.space.S100,
  borderRadius: config.radii.R300,
  backgroundColor: color.Surface.Container,
  boxShadow: config.shadow.E200,
});

export const UploadQueueSpoilerChip = style({
  position: 'absolute',
  left: config.space.S100,
  bottom: config.space.S100,
});

export const UploadQueueOverlay = style({
  position: 'absolute',
  inset: 0,
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  gap: config.space.S200,
  padding: config.space.S200,
  backgroundColor: 'rgba(0, 0, 0, 0.55)',
  color: 'white',
});

export const UploadQueueErrorOverlay = style({
  position: 'absolute',
  inset: 0,
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  gap: config.space.S200,
  padding: config.space.S200,
  backgroundColor: color.Critical.Container,
  color: color.Critical.OnContainer,
  textAlign: 'center',
});

export const UploadQueueErrorMessage = style({
  display: '-webkit-box',
  WebkitLineClamp: 3,
  WebkitBoxOrient: 'vertical',
  overflow: 'hidden',
  wordBreak: 'break-word',
});
