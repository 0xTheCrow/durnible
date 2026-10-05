import { style } from '@vanilla-extract/css';
import { MOBILE_MEDIA_QUERY } from './breakpoints';
import {
  SAFE_AREA_INSET_BOTTOM,
  SAFE_AREA_INSET_LEFT,
  SAFE_AREA_INSET_RIGHT,
  SAFE_AREA_INSET_TOP,
} from './safeArea';

export const OverlayCenterSafeArea = style({
  paddingTop: SAFE_AREA_INSET_TOP,
  paddingRight: SAFE_AREA_INSET_RIGHT,
  paddingBottom: SAFE_AREA_INSET_BOTTOM,
  paddingLeft: SAFE_AREA_INSET_LEFT,
});

export const ModalWide = style({
  minWidth: '85vw',
  minHeight: 'calc(var(--safe-viewport-height) * 0.9)',
});

export const PdfViewerModal = style([ModalWide, { borderRadius: '0' }]);

export const AudioPreviewModal = style({
  width: '27.5rem',
  maxWidth: '90vw',
  height: 'fit-content',
});

export const ImageViewerModal = style({
  width: 'fit-content',
  height: 'fit-content',
  minWidth: '20rem',
  minHeight: '15rem',
  maxWidth: '90vw',
  maxHeight: 'var(--safe-viewport-height)',
  borderRadius: '0',
  '@media': {
    [MOBILE_MEDIA_QUERY]: {
      width: '100vw',
      maxWidth: '100vw',
      minWidth: 'unset',
      margin: '0',
    },
  },
});
