import type { RecipeVariants } from '@vanilla-extract/recipes';
import { recipe } from '@vanilla-extract/recipes';
import { style } from '@vanilla-extract/css';
import { DefaultReset, config } from 'folds';

export const TimelineOverlay = recipe({
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

export const JumpToLatestOverlay = style({
  transition: 'opacity 150ms ease, transform 150ms ease',
  selectors: {
    '&[data-visible="true"]': {
      opacity: 1,
      transform: 'translateX(-50%) translateY(0)',
      pointerEvents: 'auto',
    },
    '&[data-visible="false"]': {
      opacity: 0,
      transform: 'translateX(-50%) translateY(8px)',
      pointerEvents: 'none',
    },
  },
});

export type TimelineOverlayVariants = RecipeVariants<typeof TimelineOverlay>;
