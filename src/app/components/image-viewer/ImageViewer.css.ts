import { style } from '@vanilla-extract/css';
import { DefaultReset, color } from 'folds';
import { HEADER_HEIGHT } from '../../styles/mediaFrame.css';
import { MOBILE_MEDIA_QUERY } from '../../styles/breakpoints';

export {
  Content as ImageViewerContent,
  LoadingOverlay as ImageViewerLoadingOverlay,
  PrimaryHeaderButton as ImageViewerDownloadButton,
} from '../../styles/mediaFrame.css';

export const ImageViewerGalleryMode = style({
  width: '90vw',
  height: '90vh',
  '@media': {
    [MOBILE_MEDIA_QUERY]: {
      width: '100vw',
    },
  },
});

const GALLERY_BUTTON_GUTTER_PER_SIDE = '3rem';

export const ImageViewerNavButton = style([
  DefaultReset,
  {
    position: 'absolute',
    top: 0,
    bottom: 0,
    width: GALLERY_BUTTON_GUTTER_PER_SIDE,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: 'transparent',
    border: 'none',
    cursor: 'pointer',
    color: color.Background.OnContainer,
    zIndex: 1,
    transition: 'background-color 120ms ease',
    selectors: {
      '&:hover:not(:disabled)': {
        backgroundColor: color.SurfaceVariant.ContainerHover,
      },
      '&:disabled': {
        cursor: 'default',
        opacity: 0.3,
      },
    },
  },
]);

export const ImageViewerNavButtonPrev = style({
  left: 0,
});

export const ImageViewerNavButtonNext = style({
  right: 0,
});

const GALLERY_BUTTON_GUTTER = '6rem';

export const ImageViewerImg = style([
  DefaultReset,
  {
    objectFit: 'contain',
    display: 'block',
    width: 'auto',
    height: 'auto',
    maxWidth: '85vw',
    maxHeight: `calc(85vh - ${HEADER_HEIGHT})`,
    margin: 'auto',
    touchAction: 'none',
    userSelect: 'none',
    backgroundColor: color.Surface.Container,
    '@media': {
      [MOBILE_MEDIA_QUERY]: {
        maxWidth: '100vw',
        maxHeight: `calc(85vh - ${HEADER_HEIGHT})`,
      },
    },
  },
]);

export const ImageViewerImgGallery = style({
  maxWidth: `calc(90vw - ${GALLERY_BUTTON_GUTTER})`,
  '@media': {
    [MOBILE_MEDIA_QUERY]: {
      maxWidth: `calc(100vw - ${GALLERY_BUTTON_GUTTER})`,
    },
  },
});
