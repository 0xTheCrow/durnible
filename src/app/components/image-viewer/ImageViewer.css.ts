import { style } from '@vanilla-extract/css';
import { DefaultReset, color, config } from 'folds';

export const ImageViewer = style([DefaultReset, { height: '100%', flexGrow: 1 }]);

export const ImageViewerExpanded = style({
  width: '90vw',
  height: '90vh',
  '@media': {
    'screen and (max-width: 750px)': {
      width: '100vw',
    },
  },
});

export const ImageViewerHeader = style([
  DefaultReset,
  {
    paddingLeft: config.space.S200,
    paddingRight: config.space.S200,
    borderBottomWidth: config.borderWidth.B300,
    flexShrink: 0,
    gap: config.space.S200,
  },
]);

export const ImageViewerContent = style([
  DefaultReset,
  {
    backgroundColor: color.Background.Container,
    color: color.Background.OnContainer,
    overflow: 'hidden',
  },
]);

export const ImageViewerImg = style([
  DefaultReset,
  {
    objectFit: 'contain',
    display: 'block',
    width: 'auto',
    height: 'auto',
    maxWidth: '85vw',
    maxHeight: 'calc(85vh - 2.5rem)',
    margin: 'auto',
    touchAction: 'none',
    backgroundColor: color.Surface.Container,
    '@media': {
      'screen and (max-width: 750px)': {
        maxWidth: '100vw',
      },
    },
  },
]);
