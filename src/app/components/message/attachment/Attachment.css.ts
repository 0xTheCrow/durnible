import { style } from '@vanilla-extract/css';
import type { RecipeVariants } from '@vanilla-extract/recipes';
import { recipe } from '@vanilla-extract/recipes';
import { DefaultReset, color, config, toRem } from 'folds';

export const Attachment = recipe({
  base: {
    backgroundColor: color.SurfaceVariant.Container,
    color: color.SurfaceVariant.OnContainer,
    borderRadius: config.radii.R400,
    overflow: 'hidden',
    maxWidth: '100%',
    width: toRem(400),
  },
  variants: {
    outlined: {
      true: {
        boxShadow: `inset 0 0 0 ${config.borderWidth.B300} ${color.SurfaceVariant.ContainerLine}`,
      },
    },
    media: {
      true: {
        backgroundColor: 'transparent',
        borderRadius: 0,
      },
    },
  },
});

export type AttachmentVariants = RecipeVariants<typeof Attachment>;

export const AttachmentHeader = style({
  padding: config.space.S300,
  paddingTop: config.space.S200,
  paddingBottom: config.space.S200,
});

export const AttachmentHeaderTextOnly = style({
  paddingTop: config.space.S300,
  paddingBottom: config.space.S300,
});

export const AttachmentBox = style([
  DefaultReset,
  {
    maxWidth: '100%',
    maxHeight: toRem(400),
    width: toRem(400),
    overflow: 'hidden',
  },
]);

export const AttachmentContent = style({
  padding: config.space.S300,
  paddingTop: 0,
  paddingBottom: config.space.S200,
});
