import { style } from '@vanilla-extract/css';
import { color, config } from 'folds';

export const CallStrip = style({
  padding: `${config.space.S100} ${config.space.S300}`,
  backgroundColor: color.SurfaceVariant.Container,
  color: color.SurfaceVariant.OnContainer,
  borderBottom: `${config.borderWidth.B300} solid ${color.SurfaceVariant.ContainerLine}`,
});

export const CallStripRoomName = style({
  cursor: 'pointer',
  ':hover': {
    textDecoration: 'underline',
  },
});
