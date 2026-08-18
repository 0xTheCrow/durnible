import { style } from '@vanilla-extract/css';
import { color, config } from 'folds';

export const CallScreen = style({
  display: 'grid',
  gridTemplateRows: 'auto minmax(0, 1fr) auto',
  maxWidth: '100%',
  maxHeight: '100%',
  borderRadius: 0,
  transition: 'transform 200ms ease',
});

export const CallScreenControls = style({
  padding: config.space.S300,
  borderTop: `${config.borderWidth.B300} solid ${color.Surface.ContainerLine}`,
});
