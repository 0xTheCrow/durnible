import { style } from '@vanilla-extract/css';
import { color, config, toRem } from 'folds';

export const SliderContainer = style({
  position: 'absolute',
  right: 0,
  top: 0,
  bottom: 0,
  width: toRem(48),
  zIndex: 10,
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  padding: `${toRem(4)} 0 ${toRem(24)} 0`,
});

export const SliderTrack = style({
  width: toRem(6),
  flex: 1,
  borderRadius: toRem(3),
  backgroundColor: color.SurfaceVariant.ContainerActive,
  position: 'relative',
  cursor: 'pointer',
  touchAction: 'none',
});

export const SliderThumb = style({
  position: 'absolute',
  width: toRem(40),
  height: toRem(40),
  borderRadius: toRem(20),
  backgroundColor: color.Primary.Main,
  left: '50%',
  transform: 'translate(-50%, -50%)',
  cursor: 'grab',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  boxShadow: `0 2px 8px rgba(0, 0, 0, 0.3)`,
  transition: 'width 0.1s, height 0.1s',
  selectors: {
    '&[data-dragging="true"]': {
      cursor: 'grabbing',
      width: toRem(46),
      height: toRem(46),
    },
  },
});

export const SliderThumbGrip = style({
  display: 'flex',
  flexDirection: 'column',
  gap: toRem(3),
  alignItems: 'center',
  pointerEvents: 'none',
});

export const SliderThumbGripLine = style({
  width: toRem(16),
  height: toRem(2),
  borderRadius: toRem(1),
  backgroundColor: 'rgba(255, 255, 255, 0.7)',
});

export const RangeChips = style({
  display: 'flex',
  flexDirection: 'row',
  flexWrap: 'wrap',
  justifyContent: 'center',
  gap: toRem(2),
  marginBottom: toRem(4),
  pointerEvents: 'auto',
});

export const RangeChip = style({
  padding: `${toRem(2)} ${toRem(6)}`,
  borderRadius: config.radii.R300,
  backgroundColor: color.SurfaceVariant.Container,
  border: `${config.borderWidth.B300} solid ${color.SurfaceVariant.ContainerLine}`,
  cursor: 'pointer',
  whiteSpace: 'nowrap',
  selectors: {
    '&[data-active="true"]': {
      backgroundColor: color.Primary.Main,
      borderColor: color.Primary.Main,
    },
  },
});

export const SliderTooltip = style({
  position: 'absolute',
  right: toRem(56),
  transform: 'translateY(-50%)',
  backgroundColor: color.SurfaceVariant.Container,
  padding: `${config.space.S200} ${config.space.S300}`,
  borderRadius: config.radii.R300,
  whiteSpace: 'nowrap',
  pointerEvents: 'none',
  boxShadow: `0 2px 8px rgba(0, 0, 0, 0.25)`,
  border: `${config.borderWidth.B300} solid ${color.SurfaceVariant.ContainerLine}`,
});
