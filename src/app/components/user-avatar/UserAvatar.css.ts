import { style } from '@vanilla-extract/css';
import { color } from 'folds';
import { skeletonShimmer } from '../../styles/Skeleton.css';

export const UserAvatar = style({
  backgroundColor: color.Secondary.Container,
  color: color.Secondary.OnContainer,
  textTransform: 'capitalize',

  selectors: {
    '&[data-image-loaded="true"]': {
      backgroundColor: 'transparent',
    },
    'img&': {
      color: 'transparent',
      fontSize: 0,
    },
    'img&:not([data-image-loaded="true"])': skeletonShimmer,
  },
});
