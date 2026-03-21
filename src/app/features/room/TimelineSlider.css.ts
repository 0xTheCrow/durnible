import { keyframes, style } from '@vanilla-extract/css';
import { color, config, toRem } from 'folds';

export const SliderContainer = style({
  position: 'absolute',
  right: 0,
  top: 0,
  bottom: 0,
  width: toRem(28),
  zIndex: 10,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  opacity: 0,
  transition: 'opacity 0.2s',
  selectors: {
    '&[data-visible]': {
      opacity: 1,
    },
  },
});

export const SliderTrack = style({
  width: toRem(4),
  height: '100%',
  borderRadius: toRem(2),
  backgroundColor: color.SurfaceVariant.ContainerActive,
  position: 'relative',
  cursor: 'pointer',
  touchAction: 'none',
});

export const SliderThumb = style({
  position: 'absolute',
  width: toRem(14),
  height: toRem(14),
  borderRadius: '50%',
  backgroundColor: color.Primary.Main,
  left: '50%',
  transform: 'translate(-50%, -50%)',
  cursor: 'grab',
  pointerEvents: 'none',
  selectors: {
    '&[data-dragging="true"]': {
      cursor: 'grabbing',
      width: toRem(16),
      height: toRem(16),
    },
  },
});

export const SliderTooltip = style({
  position: 'absolute',
  right: toRem(32),
  transform: 'translateY(-50%)',
  backgroundColor: color.SurfaceVariant.Container,
  padding: `${config.space.S100} ${config.space.S200}`,
  borderRadius: config.radii.R300,
  whiteSpace: 'nowrap',
  pointerEvents: 'none',
  boxShadow: `0 2px 8px rgba(0, 0, 0, 0.25)`,
  border: `${config.borderWidth.B300} solid ${color.SurfaceVariant.ContainerLine}`,
});
