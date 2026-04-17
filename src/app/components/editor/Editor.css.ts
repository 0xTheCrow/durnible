import { globalStyle, style } from '@vanilla-extract/css';
import { color, config, DefaultReset, toRem } from 'folds';

export const Editor = style([
  DefaultReset,
  {
    backgroundColor: color.SurfaceVariant.Container,
    color: color.SurfaceVariant.OnContainer,
    boxShadow: `inset 0 0 0 ${config.borderWidth.B300} ${color.SurfaceVariant.ContainerLine}`,
    borderRadius: config.radii.R400,
    overflow: 'hidden',
  },
]);

export const EditorOptions = style([
  DefaultReset,
  {
    padding: config.space.S200,
  },
]);

export const EditorTextareaScroll = style({
  overscrollBehavior: 'contain',
});

export const EditorTextarea = style([
  DefaultReset,
  {
    flexGrow: 1,
    height: '100%',
    padding: `${toRem(13)} ${toRem(1)}`,
    selectors: {
      [`${EditorTextareaScroll}:first-child &`]: {
        paddingLeft: toRem(13),
      },
      [`${EditorTextareaScroll}:last-child &`]: {
        paddingRight: toRem(13),
      },
      '&:focus': {
        outline: 'none',
      },
    },
  },
]);

export const EditorPlaceholderContainer = style([
  DefaultReset,
  {
    opacity: config.opacity.Placeholder,
    pointerEvents: 'none',
    userSelect: 'none',
  },
]);

export const EditorPlaceholderTextVisual = style([
  DefaultReset,
  {
    display: 'block',
    paddingTop: toRem(13),
    paddingLeft: toRem(1),
  },
]);

export const AlternateInput = style([
  DefaultReset,
  {
    flexGrow: 1,
    height: '100%',
    padding: `${toRem(13)} ${toRem(1)}`,
    whiteSpace: 'pre-wrap',
    wordBreak: 'break-word',
    selectors: {
      [`${EditorTextareaScroll}:first-child &`]: {
        paddingLeft: toRem(13),
      },
      [`${EditorTextareaScroll}:last-child &`]: {
        paddingRight: toRem(13),
      },
      '&:focus': {
        outline: 'none',
      },
      '&[data-empty]::before': {
        content: 'attr(data-placeholder)',
        opacity: config.opacity.Placeholder,
        pointerEvents: 'none',
        userSelect: 'none',
      },
    },
  },
]);

globalStyle(`${AlternateInput} code`, {
  fontFamily: 'monospace',
  padding: `0 ${config.space.S100}`,
  background: color.SurfaceVariant.Container,
  border: `${config.borderWidth.B300} solid ${color.SurfaceVariant.ContainerLine}`,
  borderRadius: config.radii.R300,
});

globalStyle(`${AlternateInput} [data-mx-spoiler]`, {
  padding: `0 ${config.space.S100}`,
  backgroundColor: color.SurfaceVariant.ContainerActive,
  borderRadius: config.radii.R300,
});

globalStyle(`${AlternateInput} blockquote`, {
  paddingLeft: config.space.S200,
  borderLeft: `${config.borderWidth.B700} solid ${color.SurfaceVariant.ContainerLine}`,
  fontStyle: 'italic',
  margin: `${config.space.S200} 0`,
});

globalStyle(`${AlternateInput} pre`, {
  fontFamily: 'monospace',
  padding: config.space.S200,
  background: color.SurfaceVariant.Container,
  border: `${config.borderWidth.B300} solid ${color.SurfaceVariant.ContainerLine}`,
  borderRadius: config.radii.R300,
  margin: `${config.space.S200} 0`,
});

export const EditorToolbarBase = style({
  padding: `0 ${config.borderWidth.B300}`,
});

export const EditorToolbar = style({
  padding: config.space.S100,
});

export const MarkdownBtnBox = style({
  paddingRight: config.space.S100,
});
