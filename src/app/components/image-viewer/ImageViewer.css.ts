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

// Applied when the viewer is showing a multi-image gallery so the modal
// expands to full size (matching the zoomed-in dimensions). This gives the
// nav buttons room to sit on the left/right edges without overlapping the
// image — see ImageViewerImgGallery for the matching image max-width.
export const ImageViewerGalleryMode = style({
  width: '90vw',
  height: '90vh',
  '@media': {
    'screen and (max-width: 750px)': {
      width: '100vw',
    },
  },
});

// Header height — bumped from the folds default so the buttons inside have
// more breathing room and a larger click target. Image max-height below
// subtracts the same value so the photo still fits within the modal.
const HEADER_HEIGHT = '3rem';
const HEADER_HEIGHT_MOBILE = '3rem';

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

export const ImageViewerZoomChip = style({
  width: '3.5rem',
  height: '2.25rem',
  justifyContent: 'center',
});

export const ImageViewerContent = style([
  DefaultReset,
  {
    backgroundColor: color.Background.Container,
    color: color.Background.OnContainer,
    overflow: 'hidden',
  },
]);

// Shared base for header edge buttons (close + download). They extend to
// the top and bottom edges of the header and to one horizontal edge (left
// for close, right for download), giving a large square hit area in the
// corner of the viewer. Each must be a direct child of <Header> — wrapping
// them inside an alignItems="Center" Box collapses the Box to content
// height and prevents alignSelf: 'stretch' from reaching the header edges.
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

// Header close (back arrow) button — extends to the left, top, and bottom
// edges of the header so the entire corner is a click target.
export const ImageViewerCloseButton = style([
  DefaultReset,
  headerEdgeButtonBase,
  {
    // Pull past the header's left padding so the button reaches the edge.
    marginLeft: `calc(-1 * ${config.space.S300})`,
    '@media': {
      'screen and (max-width: 750px)': {
        width: HEADER_HEIGHT_MOBILE,
      },
    },
  },
]);

// Header download button — mirrors the close button on the right side but
// uses the Primary variant background and includes a "Download" label
// alongside the icon, so the width is content-sized rather than square.
export const ImageViewerDownloadButton = style([
  DefaultReset,
  {
    alignSelf: 'stretch',
    flexShrink: 0,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: config.space.S200,
    paddingLeft: config.space.S500,
    paddingRight: config.space.S500,
    // Pull past the header's right padding so the button reaches the edge.
    marginRight: `calc(-1 * ${config.space.S300})`,
    '@media': {
      'screen and (max-width: 750px)': {
        paddingLeft: config.space.S300,
        paddingRight: config.space.S300,
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

// Each nav button fills its full gutter — top to bottom of the content area
// and edge-to-image — so the entire gutter is a click target. The icon sits
// centered within that box.
const GALLERY_BUTTON_GUTTER_PER_SIDE = '4rem';

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

// Total horizontal space carved out for nav buttons (both sides combined).
// 1rem edge offset + ~2.5rem button + 0.5rem gap to image, mirrored on both
// sides → 8rem total.
const GALLERY_BUTTON_GUTTER = '8rem';

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

// In gallery mode the viewer is full size and the image must leave room on
// both sides for the nav buttons. The desktop max-width carves out a fixed
// gutter; on mobile we still need *some* gutter so the buttons aren't on top
// of the photo, but we let the image use the rest of the viewport.
export const ImageViewerImgGallery = style({
  maxWidth: `calc(90vw - ${GALLERY_BUTTON_GUTTER})`,
  '@media': {
    'screen and (max-width: 750px)': {
      maxWidth: `calc(100vw - ${GALLERY_BUTTON_GUTTER})`,
    },
  },
});
