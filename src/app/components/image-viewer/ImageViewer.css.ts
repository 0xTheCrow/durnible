import { style } from '@vanilla-extract/css';
import { DefaultReset, color, config } from 'folds';
import { HEADER_HEIGHT } from '../../styles/mediaFrame.css';

export {
  Frame as ImageViewer,
  FrameExpanded as ImageViewerExpanded,
  Header as ImageViewerHeader,
  Content as ImageViewerContent,
  LoadingOverlay as ImageViewerLoadingOverlay,
  CloseButton as ImageViewerCloseButton,
  PrimaryHeaderButton as ImageViewerDownloadButton,
} from '../../styles/mediaFrame.css';

export const ImageViewerGalleryMode = style({
  width: '90vw',
  height: '90vh',
  '@media': {
    'screen and (max-width: 750px)': {
      width: '100vw',
    },
  },
});

const zoomButtonBase = {
  alignSelf: 'stretch',
  flexShrink: 0,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  background: 'transparent',
  border: 'none',
  borderRadius: 0,
  cursor: 'pointer',
  color: 'inherit',
  transition: 'background-color 120ms ease',
  selectors: {
    '&:hover': {
      backgroundColor: color.SurfaceVariant.ContainerHover,
    },
    '&:focus-visible': {
      outline: `${config.borderWidth.B400} solid ${color.Primary.Main}`,
      outlineOffset: `calc(-1 * ${config.borderWidth.B400})`,
    },
  },
} as const;

export const ImageViewerZoomGroup = style({
  alignSelf: 'stretch',
  display: 'flex',
  flexShrink: 0,
});

export const ImageViewerZoomButton = style([
  DefaultReset,
  zoomButtonBase,
  { width: HEADER_HEIGHT },
]);

export const ImageViewerZoomChip = style([
  DefaultReset,
  zoomButtonBase,
  { width: '3rem', paddingLeft: config.space.S200, paddingRight: config.space.S200 },
]);

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
      'screen and (max-width: 750px)': {
        maxWidth: '100vw',
        maxHeight: `calc(85vh - ${HEADER_HEIGHT})`,
      },
    },
  },
]);

export const ImageViewerImgGallery = style({
  maxWidth: `calc(90vw - ${GALLERY_BUTTON_GUTTER})`,
  '@media': {
    'screen and (max-width: 750px)': {
      maxWidth: `calc(100vw - ${GALLERY_BUTTON_GUTTER})`,
    },
  },
});
