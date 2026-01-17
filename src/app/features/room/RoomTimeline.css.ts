import { style } from '@vanilla-extract/css';
import { RecipeVariants, recipe } from '@vanilla-extract/recipes';
import { DefaultReset, config } from 'folds';

export const TimelineFloat = recipe({
  base: [
    DefaultReset,
    {
      position: 'absolute',
      left: '50%',
      transform: 'translateX(-50%)',
      zIndex: 1,
      minWidth: 'max-content',
    },
  ],
  variants: {
    position: {
      Top: {
        top: config.space.S400,
      },
      Bottom: {
        bottom: config.space.S400,
      },
    },
  },
  defaultVariants: {
    position: 'Top',
  },
});

export type TimelineFloatVariants = RecipeVariants<typeof TimelineFloat>;

export const TimelineScrollFrame = style({
  outline: 'none',
  display: 'flex',
  flexDirection: 'column',
  flexGrow: 1,
  minWidth: 0,
  minHeight: 0,
});

export const TimelineScroll = style({
  outline: 'none',
  flexGrow: 1,
  minWidth: 0,
  minHeight: 0,
  maxWidth: '100%',
});
