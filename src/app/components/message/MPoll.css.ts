import { style } from '@vanilla-extract/css';
import { DefaultReset, color, config, toRem } from 'folds';

export const PollContainer = style([
  DefaultReset,
  {
    display: 'flex',
    flexDirection: 'column',
    gap: config.space.S200,
    maxWidth: toRem(400),
  },
]);

export const PollQuestion = style([
  DefaultReset,
  {
    fontWeight: 600,
  },
]);

export const PollOption = style([
  DefaultReset,
  {
    display: 'flex',
    flexDirection: 'column',
    gap: toRem(2),
    padding: `${config.space.S200} ${config.space.S300}`,
    borderRadius: config.radii.R400,
    border: `${config.borderWidth.B300} solid ${color.SurfaceVariant.ContainerLine}`,
    cursor: 'pointer',
    backgroundColor: color.SurfaceVariant.Container,
    position: 'relative',
    overflow: 'hidden',
    selectors: {
      '&:hover': {
        backgroundColor: color.SurfaceVariant.ContainerHover,
      },
      '&[aria-pressed=true]': {
        borderColor: color.Primary.ContainerLine,
        backgroundColor: color.Primary.Container,
      },
      '&[aria-disabled=true]': {
        cursor: 'default',
      },
    },
  },
]);

export const PollOptionBar = style([
  DefaultReset,
  {
    position: 'absolute',
    left: 0,
    bottom: 0,
    height: toRem(3),
    backgroundColor: color.Secondary.Main,
    borderRadius: toRem(2),
    transition: 'width 0.3s ease',
  },
]);

export const PollEnded = style([
  DefaultReset,
  {
    fontStyle: 'italic',
  },
]);
