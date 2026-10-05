import { globalStyle, style } from '@vanilla-extract/css';
import { recipe } from '@vanilla-extract/recipes';
import { DefaultReset, color, config, toRem } from 'folds';
import { MOBILE_MEDIA_QUERY } from '../../../styles/breakpoints';
import {
  IOS_WEBKIT_SUPPORTS_QUERY,
  SAFE_AREA_INSET_BOTTOM,
  STANDALONE_DISPLAY_MEDIA_QUERY,
} from '../../../styles/safeArea';

const IOS_STANDALONE_MOBILE_MEDIA_QUERY = `${MOBILE_MEDIA_QUERY} and ${STANDALONE_DISPLAY_MEDIA_QUERY}`;
const HOME_INDICATOR_CLEARANCE = '21px';

export const RoomViewFollowingPlaceholder = style([
  DefaultReset,
  {
    height: toRem(16),
    '@media': {
      [MOBILE_MEDIA_QUERY]: {
        height: toRem(8),
      },
      [IOS_STANDALONE_MOBILE_MEDIA_QUERY]: {
        '@supports': {
          [IOS_WEBKIT_SUPPORTS_QUERY]: {
            height: `max(${toRem(8)}, min(${SAFE_AREA_INSET_BOTTOM}, ${HOME_INDICATOR_CLEARANCE}))`,
          },
        },
      },
    },
  },
]);

globalStyle(`#root:has(.${RoomViewFollowingPlaceholder})`, {
  '@media': {
    [IOS_STANDALONE_MOBILE_MEDIA_QUERY]: {
      '@supports': {
        [IOS_WEBKIT_SUPPORTS_QUERY]: {
          paddingBottom: 0,
        },
      },
    },
  },
});

export const RoomViewFollowing = recipe({
  base: [
    DefaultReset,
    {
      minHeight: toRem(28),
      padding: `0 ${config.space.S400}`,
      width: '100%',
      backgroundColor: color.Surface.Container,
      color: color.Surface.OnContainer,
      outline: 'none',
    },
  ],
  variants: {
    clickable: {
      true: {
        cursor: 'pointer',
        selectors: {
          '&:hover, &:focus-visible': {
            color: color.Primary.Main,
          },
          '&:active': {
            color: color.Primary.Main,
          },
        },
      },
    },
  },
});
