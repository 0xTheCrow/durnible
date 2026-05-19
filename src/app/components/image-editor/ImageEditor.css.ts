import { globalStyle, style } from '@vanilla-extract/css';
import { HeaderEdgeButton, PrimaryHeaderButton } from '../../styles/mediaFrame.css';

export {
  Frame as ImageEditor,
  FrameExpanded as ImageEditorExpanded,
  Header as ImageEditorHeader,
  Content as ImageEditorContent,
  CloseButton as ImageEditorCloseButton,
  HeaderEdgeButton as ImageEditorToolButton,
} from '../../styles/mediaFrame.css';

export const ImageEditorSaveButton = style([
  PrimaryHeaderButton,
  {
    paddingRight: '1rem',
  },
]);

export const ImageEditorRotateGroup = style({
  alignSelf: 'stretch',
  display: 'flex',
  flexShrink: 0,
});

export const ImageEditorCropToggle = style([
  HeaderEdgeButton,
  {
    width: 'auto',
    paddingLeft: '0.5rem',
    paddingRight: '1rem',
    gap: '0.375rem',
  },
]);

export const ImageEditorCropper = style({
  width: '100%',
  height: '100%',
});

globalStyle(`${ImageEditorCropper} .advanced-cropper-wrapper__fade`, {
  opacity: 1,
  transition: 'none',
});

export const ImageEditorPreview = style({
  maxWidth: '100%',
  maxHeight: '100%',
  objectFit: 'contain',
  userSelect: 'none',
});

export const ImageEditorMirroredIcon = style({
  transform: 'scaleX(-1)',
});
