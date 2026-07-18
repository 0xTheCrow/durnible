import { globalStyle, style } from '@vanilla-extract/css';
import { config, toRem } from 'folds';

export const ReplyBend = style({
  flexShrink: 0,
});

export const ThreadIndicator = style({
  opacity: config.opacity.P300,

  selectors: {
    'button&': {
      cursor: 'pointer',
    },
    ':hover&': {
      opacity: config.opacity.P500,
    },
  },
});

export const Reply = style({
  marginBottom: toRem(1),
  flexGrow: 1,
  minWidth: 0,
  maxWidth: '100%',
  minHeight: config.lineHeight.T300,
  selectors: {
    'button&': {
      cursor: 'pointer',
    },
  },
});

export const ReplyContent = style({
  opacity: config.opacity.P300,

  selectors: {
    [`${Reply}:hover &`]: {
      opacity: config.opacity.P500,
    },
  },
});

export const FormattedReplyBody = style({
  pointerEvents: 'none',
});

globalStyle(
  `${FormattedReplyBody} p, ${FormattedReplyBody} pre, ${FormattedReplyBody} ul, ${FormattedReplyBody} ol, ${FormattedReplyBody} li`,
  {
    display: 'inline',
    margin: 0,
    padding: 0,
    border: 'none',
    fontStyle: 'inherit',
    listStyle: 'none',
  }
);

globalStyle(`${FormattedReplyBody} ol`, {
  counterReset: 'reply-ordered-list',
});

globalStyle(`${FormattedReplyBody} ul li::before`, {
  content: '"- "',
});

globalStyle(`${FormattedReplyBody} ol li::before`, {
  counterIncrement: 'reply-ordered-list',
  content: 'counter(reply-ordered-list) ". "',
});

globalStyle(`${FormattedReplyBody} li::after`, {
  content: '" "',
});

globalStyle(`${FormattedReplyBody} blockquote`, {
  display: 'inline',
  marginTop: 0,
  marginBottom: 0,
});

globalStyle(`${FormattedReplyBody} br`, {
  display: 'none',
});

globalStyle(`${FormattedReplyBody} img`, {
  display: 'inline',
  maxHeight: config.lineHeight.T300,
  verticalAlign: 'middle',
});
