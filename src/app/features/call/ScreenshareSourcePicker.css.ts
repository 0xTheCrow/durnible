import { style } from '@vanilla-extract/css';
import { color, config, toRem } from 'folds';

export const PickerBody = style({
  padding: config.space.S400,
  display: 'flex',
  flexDirection: 'column',
  gap: config.space.S400,
});

export const SourceScroll = style({
  maxHeight: toRem(360),
  overflowY: 'auto',
});

export const SourceGrid = style({
  display: 'grid',
  gridTemplateColumns: `repeat(auto-fill, minmax(${toRem(150)}, 1fr))`,
  gap: config.space.S200,
});

export const SourceButton = style({
  display: 'flex',
  flexDirection: 'column',
  gap: config.space.S100,
  padding: config.space.S100,
  borderRadius: config.radii.R300,
  border: `${config.borderWidth.B300} solid transparent`,
  backgroundColor: color.SurfaceVariant.Container,
  color: color.SurfaceVariant.OnContainer,
  cursor: 'pointer',
  textAlign: 'start',
  selectors: {
    '&[aria-pressed="true"]': {
      borderColor: color.Primary.Main,
      backgroundColor: color.Primary.Container,
      color: color.Primary.OnContainer,
    },
  },
});

export const SourceThumbnail = style({
  width: '100%',
  aspectRatio: '16 / 9',
  objectFit: 'contain',
  borderRadius: config.radii.R300,
  backgroundColor: color.Surface.Container,
});

export const SourceName = style({
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
});
