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

export const ImageViewerGalleryMode = style({
  width: '90vw',
  height: '90vh',
  '@media': {
    'screen and (max-width: 750px)': {
      width: '100vw',
    },
  },
});

const HEADER_HEIGHT = '2.25rem';
const HEADER_HEIGHT_MOBILE = '2.25rem';

export const ImageViewerHeader = style([
  DefaultReset,
  {
    minHeight: HEADER_HEIGHT,
    height: HEADER_HEIGHT,
    paddingLeft: config.space.S300,
    paddingRight: config.space.S300,
    borderBottomWidth: config.borderWidth.B300,
    flexShrink: 0,
    gap: config.space.S300,
    '@media': {
      'screen and (max-width: 750px)': {
        gap: config.space.S200,
      },
    },
  },
]);

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

export const ImageViewerContent = style([
  DefaultReset,
  {
    backgroundColor: color.Background.Container,
    color: color.Background.OnContainer,
    overflow: 'hidden',
  },
]);

const headerEdgeButtonBase = {
  alignSelf: 'stretch',
  width: HEADER_HEIGHT,
  flexShrink: 0,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  background: 'transparent',
  border: 'none',
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

export const ImageViewerCloseButton = style([
  DefaultReset,
  headerEdgeButtonBase,
  {
    marginLeft: `calc(-1 * ${config.space.S300})`,
    '@media': {
      'screen and (max-width: 750px)': {
        width: HEADER_HEIGHT_MOBILE,
      },
    },
  },
]);

export const ImageViewerDownloadButton = style([
  DefaultReset,
  {
    alignSelf: 'stretch',
    flexShrink: 0,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: config.space.S200,
    paddingLeft: config.space.S400,
    paddingRight: config.space.S400,
    marginRight: `calc(-1 * ${config.space.S300})`,
    '@media': {
      'screen and (max-width: 750px)': {
        paddingLeft: config.space.S200,
        paddingRight: config.space.S200,
      },
    },
    backgroundColor: color.Primary.Main,
    color: color.Primary.OnMain,
    border: 'none',
    cursor: 'pointer',
    fontWeight: 600,
    transition: 'background-color 120ms ease',
    selectors: {
      '&:hover': {
        backgroundColor: color.Primary.MainHover,
      },
      '&:focus-visible': {
        outline: `${config.borderWidth.B400} solid ${color.Primary.Main}`,
        outlineOffset: `calc(-1 * ${config.borderWidth.B400})`,
      },
    },
  },
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
        maxHeight: `calc(85vh - ${HEADER_HEIGHT_MOBILE})`,
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
