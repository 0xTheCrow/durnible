import { style } from '@vanilla-extract/css';
import { RecipeVariants, recipe } from '@vanilla-extract/recipes';
import { DefaultReset, config, toRem } from 'folds';

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

export const MobileScrollPadding = style({
  '@media': {
    'screen and (max-width: 750px)': {
      paddingBottom: toRem(56),
    },
  },
});
