import { createVar, globalStyle, style } from '@vanilla-extract/css';
import { toRem, color, config, DefaultReset, FocusOutline } from 'folds';
import { skeletonShimmer } from '../../../styles/Skeleton.css';

/**
 * Layout
 */

export const Base = style({
  width: '100vw',
  maxWidth: toRem(500),
  height: toRem(450),
  maxHeight: `var(--emoji-board-max-height, calc(var(--app-height, 100vh) - ${toRem(96)}))`,
  backgroundColor: color.Surface.Container,
  color: color.Surface.OnContainer,
  border: `${config.borderWidth.B300} solid ${color.Surface.ContainerLine}`,
  borderRadius: config.radii.R400,
  boxShadow: config.shadow.E200,
  overflow: 'hidden',
});

export const Header = style({
  padding: config.space.S300,
  paddingBottom: 0,
});

/**
 * Sidebar
 */

export const Sidebar = style({
  width: toRem(54),
  backgroundColor: color.Surface.Container,
  color: color.Surface.OnContainer,
  position: 'relative',
});

export const SidebarContent = style({
  padding: `${config.space.S200} 0`,
});

export const SidebarStack = style({
  width: '100%',
  backgroundColor: color.Surface.Container,
});

export const SidebarDivider = style({
  width: toRem(18),
});

export const SidebarBtnImg = style({
  width: toRem(24),
  height: toRem(24),
  objectFit: 'contain',
});

const DropLineDist = createVar();
export const SidebarDropTarget = style({
  position: 'relative',
  vars: {
    [DropLineDist]: toRem(-4),
  },
  selectors: {
    '&[data-drop-above=true]::after, &[data-drop-below=true]::after': {
      content: '',
      display: 'block',
      position: 'absolute',
      left: toRem(0),
      width: '100%',
      height: config.borderWidth.B700,
      backgroundColor: color.Success.Main,
    },
    '&[data-drop-above=true]::after': {
      top: DropLineDist,
    },
    '&[data-drop-below=true]::after': {
      bottom: DropLineDist,
    },
  },
});

/**
 * Preview
 */

const PreviewHeight = toRem(56);
const PreviewScrollReserve = `calc(${PreviewHeight} + ${config.space.S300})`;

export const Preview = style({
  position: 'absolute',
  bottom: config.space.S300,
  left: config.space.S300,
  right: config.space.S300,

  padding: config.space.S200,
  minHeight: toRem(40),

  borderRadius: config.radii.R400,
  backgroundColor: color.SurfaceVariant.Container,
  color: color.SurfaceVariant.OnContainer,
});

export const PreviewArea = style({
  position: 'relative',
});

export const PreviewScroll = style({
  scrollPaddingBottom: PreviewScrollReserve,
});

export const PreviewSpacer = style({
  paddingBottom: PreviewScrollReserve,
});

export const PreviewEmoji = style([
  DefaultReset,
  {
    width: toRem(32),
    height: toRem(32),
    fontSize: toRem(32),
    lineHeight: toRem(32),
  },
]);
export const PreviewImg = style([
  DefaultReset,
  {
    width: toRem(32),
    height: toRem(32),
    objectFit: 'contain',
  },
]);

/**
 * Group
 */

export const EmojiGroup = style({
  position: 'relative',
  padding: `${config.space.S100} 0`,
});

globalStyle(`${EmojiGroup}[data-group-id="search_group"] button:first-of-type`, {
  backgroundColor: color.Primary.Container,
  color: color.Primary.OnContainer,
});

export const EmojiGroupLabel = style({
  position: 'sticky',
  top: config.space.S200,
  zIndex: 1,

  margin: 'auto',
  padding: `${config.space.S100} ${config.space.S200}`,
  borderRadius: config.radii.Pill,
  backgroundColor: color.SurfaceVariant.Container,
  color: color.SurfaceVariant.OnContainer,
});

export const EmojiGroupContent = style([
  DefaultReset,
  {
    padding: 0,
    paddingLeft: config.space.S300,
    paddingRight: config.space.S100,
  },
]);

/**
 * Item
 */

export const EmojiItem = style([
  DefaultReset,
  FocusOutline,
  {
    width: toRem(48),
    height: toRem(48),
    fontSize: toRem(32),
    lineHeight: toRem(32),
    borderRadius: config.radii.R400,
    cursor: 'pointer',

    ':hover': {
      backgroundColor: color.Surface.ContainerHover,
    },
  },
]);

export const StickerItem = style([
  EmojiItem,
  {
    width: toRem(112),
    height: toRem(112),
  },
]);

export const CustomEmojiImg = style([
  DefaultReset,
  {
    width: toRem(32),
    height: toRem(32),
    objectFit: 'contain',
    color: 'transparent',
    fontSize: 0,
    borderRadius: config.radii.R300,

    selectors: {
      '&:not([data-image-loaded="true"])': skeletonShimmer,
      '&[data-image-loaded="true"]': {
        backgroundColor: 'transparent',
      },
    },
  },
]);

export const StickerImg = style([
  DefaultReset,
  {
    width: toRem(96),
    height: toRem(96),
    objectFit: 'contain',
    color: 'transparent',
    fontSize: 0,
    borderRadius: config.radii.R400,

    selectors: {
      '&:not([data-image-loaded="true"])': skeletonShimmer,
      '&[data-image-loaded="true"]': {
        backgroundColor: 'transparent',
      },
    },
  },
]);

/**
 * Tabs
 */

export const EmojiBoardTabBtn = style({
  transition: 'background-color 80ms ease',
  selectors: {
    '&[data-tab-active="false"]:hover': {
      backgroundColor: color.Secondary.ContainerHover,
    },
    '&[data-tab-active="true"]:hover': {
      backgroundColor: color.Secondary.MainHover,
    },
  },
});

/**
 * GIF
 */

export const GifGrid = style({
  padding: config.space.S200,
  paddingLeft: config.space.S300,
  paddingRight: config.space.S100,
});

export const GifRow = style({
  display: 'grid',
  gridTemplateColumns: '1fr 1fr',
  gap: config.space.S200,
  marginBottom: config.space.S200,
});

export const GifItem = style([
  DefaultReset,
  FocusOutline,
  {
    cursor: 'pointer',
    borderRadius: config.radii.R300,
    overflow: 'hidden',
    display: 'block',
    width: '100%',
    maxHeight: toRem(200),
    backgroundColor: color.SurfaceVariant.Container,
    ':hover': {
      outline: `${config.borderWidth.B300} solid ${color.Primary.Main}`,
    },
  },
]);

export const GifUploadDropzone = style([
  DefaultReset,
  FocusOutline,
  {
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    height: toRem(160),
    overflow: 'hidden',
    borderRadius: config.radii.R300,
    border: `${config.borderWidth.B300} dashed ${color.Surface.ContainerLine}`,
    backgroundColor: color.SurfaceVariant.Container,
    color: color.SurfaceVariant.OnContainer,
    ':hover': {
      borderColor: color.Primary.Main,
      color: color.Primary.Main,
    },
  },
]);

export const GifPreviewBox = style({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  width: '100%',
  height: toRem(160),
  overflow: 'hidden',
  borderRadius: config.radii.R300,
  border: `${config.borderWidth.B300} solid ${color.Surface.ContainerLine}`,
  backgroundColor: color.SurfaceVariant.Container,
});

export const GifPreviewActions = style({
  position: 'absolute',
  bottom: config.space.S100,
  right: config.space.S100,
  zIndex: 1,
  display: 'flex',
  gap: config.space.S100,
});

export const GifPreviewActionsLeft = style({
  position: 'absolute',
  bottom: config.space.S100,
  left: config.space.S100,
  zIndex: 1,
  display: 'flex',
  gap: config.space.S100,
});

const gifEditBtnBgTransition = 'background-color 80ms ease';

export const GifEditBtnTransition = style({
  transition: gifEditBtnBgTransition,
});

export const GifPreviewDeleteBtn = style({
  backgroundColor: color.Critical.ContainerHover,
  transition: gifEditBtnBgTransition,
  ':hover': {
    backgroundColor: color.Critical.Container,
  },
});

export const GifPreviewReplaceBtn = style({
  backgroundColor: color.Surface.Container,
  transition: gifEditBtnBgTransition,
});

export const GifPreviewConfirm = style({
  position: 'absolute',
  inset: 0,
  zIndex: 2,
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  gap: config.space.S500,
  padding: config.space.S300,
  borderRadius: config.radii.R300,
  backgroundColor: 'rgba(0, 0, 0, 0.55)',
});

export const GifUploadDropzoneImg = style([
  DefaultReset,
  {
    maxWidth: '100%',
    maxHeight: '100%',
    display: 'block',
  },
]);

export const GifItemImg = style([
  DefaultReset,
  {
    width: '100%',
    height: '100%',
    objectFit: 'contain',
    display: 'block',
  },
]);

export const GifItemWrap = style({
  position: 'relative',
});

export const GifItemActions = style({
  position: 'absolute',
  top: config.space.S100,
  right: config.space.S100,
  zIndex: 1,
  display: 'flex',
  gap: config.space.S100,
});

export const GifItemActionBtn = style({
  backgroundColor: color.Surface.Container,
  opacity: 0.85,
  selectors: {
    '&:hover': {
      opacity: 1,
    },
  },
});

export const GifItemHiddenBadge = style({
  position: 'absolute',
  bottom: config.space.S100,
  right: config.space.S100,
  zIndex: 1,
  pointerEvents: 'none',
  backgroundColor: color.Surface.Container,
  opacity: 0.6,
});
