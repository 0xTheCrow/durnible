import { style } from '@vanilla-extract/css';
import { MOBILE_MEDIA_QUERY } from './breakpoints';

export const OverlayCenterSafeArea = style({
  paddingTop: 'var(--safe-area-inset-top, env(safe-area-inset-top, 0px))',
  paddingRight: 'var(--safe-area-inset-right, env(safe-area-inset-right, 0px))',
  paddingBottom: 'var(--safe-area-inset-bottom, env(safe-area-inset-bottom, 0px))',
  paddingLeft: 'var(--safe-area-inset-left, env(safe-area-inset-left, 0px))',
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
