/**
 * Revy Message Styles
 * Premium message design for Revy Comms
 *
 * Design Rules:
 * - Avatar only on first message in time-grouped cluster (5 min window)
 * - Timestamps appear on hover for middle messages
 * - Reactions appear on hover, persist if used
 * - AI messages have subtle gradient left border + robot icon
 * - Rich cards for files, links, AI outputs
 */

import { style, keyframes, createVar, globalStyle } from '@vanilla-extract/css';
import { recipe, RecipeVariants } from '@vanilla-extract/recipes';
import { DefaultReset, toRem } from 'folds';

// ============================================================================
// MESSAGE CONTAINER
// ============================================================================

export const MessageContainer = recipe({
  base: [
    DefaultReset,
    {
      position: 'relative',
      padding: `${toRem(4)} ${toRem(20)}`,
      transition: 'background-color 50ms ease',

      selectors: {
        '&:hover': {
          backgroundColor: 'rgba(255, 255, 255, 0.02)',
        },
      },
    },
  ],
  variants: {
    highlight: {
      true: {
        backgroundColor: 'rgba(99, 102, 241, 0.08)',
      },
    },
    selected: {
      true: {
        backgroundColor: 'rgba(99, 102, 241, 0.12)',
      },
    },
    isAI: {
      true: {
        position: 'relative',
        selectors: {
          '&::before': {
            content: '""',
            position: 'absolute',
            left: 0,
            top: toRem(8),
            bottom: toRem(8),
            width: toRem(3),
            background: 'linear-gradient(180deg, #6366F1 0%, #EC4899 100%)',
            borderRadius: `0 ${toRem(2)} ${toRem(2)} 0`,
          },
        },
      },
    },
    isFirst: {
      true: {
        paddingTop: toRem(16),
      },
    },
  },
  defaultVariants: {
    highlight: false,
    selected: false,
    isAI: false,
    isFirst: false,
  },
});
export type MessageContainerVariants = RecipeVariants<typeof MessageContainer>;

// ============================================================================
// MESSAGE LAYOUT
// ============================================================================

export const MessageLayout = style({
  display: 'flex',
  gap: toRem(12),
});

export const MessageAvatarArea = style({
  width: toRem(40),
  flexShrink: 0,
  display: 'flex',
  justifyContent: 'center',
});

export const MessageAvatar = recipe({
  base: [
    DefaultReset,
    {
      width: toRem(40),
      height: toRem(40),
      borderRadius: toRem(10),
      overflow: 'hidden',
      flexShrink: 0,
      cursor: 'pointer',
      transition: 'transform 100ms ease',

      selectors: {
        '&:hover': {
          transform: 'scale(1.05)',
        },
      },
    },
  ],
  variants: {
    size: {
      sm: {
        width: toRem(24),
        height: toRem(24),
        borderRadius: toRem(6),
      },
      md: {
        width: toRem(32),
        height: toRem(32),
        borderRadius: toRem(8),
      },
      lg: {
        width: toRem(40),
        height: toRem(40),
        borderRadius: toRem(10),
      },
    },
  },
  defaultVariants: {
    size: 'lg',
  },
});
export type MessageAvatarVariants = RecipeVariants<typeof MessageAvatar>;

export const MessageAvatarImage = style({
  width: '100%',
  height: '100%',
  objectFit: 'cover',
});

export const MessageAvatarFallback = style({
  width: '100%',
  height: '100%',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  backgroundColor: '#6366F1',
  color: '#FFFFFF',
  fontSize: toRem(14),
  fontWeight: 600,
});

// AI Avatar special style
export const MessageAvatarAI = style({
  background: 'linear-gradient(135deg, #6366F1 0%, #EC4899 100%)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  color: '#FFFFFF',
});

export const MessageContent = style({
  flex: 1,
  minWidth: 0,
});

// ============================================================================
// MESSAGE HEADER
// ============================================================================

export const MessageHeader = style({
  display: 'flex',
  alignItems: 'baseline',
  gap: toRem(8),
  marginBottom: toRem(4),
});

export const MessageUsername = recipe({
  base: {
    fontSize: toRem(14),
    fontWeight: 600,
    color: '#FAFAFA',
    cursor: 'pointer',
    transition: 'color 100ms ease',

    selectors: {
      '&:hover': {
        color: '#6366F1',
      },
    },
  },
  variants: {
    isAI: {
      true: {
        background: 'linear-gradient(90deg, #6366F1 0%, #EC4899 100%)',
        WebkitBackgroundClip: 'text',
        WebkitTextFillColor: 'transparent',
        backgroundClip: 'text',
      },
    },
  },
});
export type MessageUsernameVariants = RecipeVariants<typeof MessageUsername>;

export const MessageTimestamp = recipe({
  base: {
    fontSize: toRem(11),
    color: '#6E6E73',
    fontWeight: 400,
    transition: 'opacity 100ms ease',
  },
  variants: {
    hover: {
      true: {
        opacity: 0,

        selectors: {
          '*:hover > &': {
            opacity: 1,
          },
        },
      },
    },
  },
  defaultVariants: {
    hover: false,
  },
});
export type MessageTimestampVariants = RecipeVariants<typeof MessageTimestamp>;

export const MessageBadge = recipe({
  base: [
    DefaultReset,
    {
      padding: `${toRem(2)} ${toRem(6)}`,
      borderRadius: toRem(4),
      fontSize: toRem(10),
      fontWeight: 500,
      textTransform: 'uppercase',
      letterSpacing: '0.02em',
    },
  ],
  variants: {
    variant: {
      ai: {
        background: 'linear-gradient(90deg, rgba(99, 102, 241, 0.2) 0%, rgba(236, 72, 153, 0.2) 100%)',
        color: '#EC4899',
      },
      bot: {
        backgroundColor: 'rgba(99, 102, 241, 0.15)',
        color: '#6366F1',
      },
      mod: {
        backgroundColor: 'rgba(34, 197, 94, 0.15)',
        color: '#22C55E',
      },
      admin: {
        backgroundColor: 'rgba(245, 158, 11, 0.15)',
        color: '#F59E0B',
      },
    },
  },
});
export type MessageBadgeVariants = RecipeVariants<typeof MessageBadge>;

// ============================================================================
// MESSAGE BODY
// ============================================================================

export const MessageBody = recipe({
  base: {
    fontSize: toRem(14),
    lineHeight: 1.6,
    color: '#FAFAFA',
    wordBreak: 'break-word',
    overflowWrap: 'break-word',
  },
  variants: {
    emote: {
      true: {
        fontStyle: 'italic',
        color: '#A1A1A6',
      },
    },
    notice: {
      true: {
        color: '#6E6E73',
      },
    },
  },
  defaultVariants: {
    emote: false,
    notice: false,
  },
});
export type MessageBodyVariants = RecipeVariants<typeof MessageBody>;

// Message text styling
globalStyle(`${MessageBody.classNames.base} p`, {
  margin: 0,
});

globalStyle(`${MessageBody.classNames.base} p + p`, {
  marginTop: toRem(8),
});

globalStyle(`${MessageBody.classNames.base} a`, {
  color: '#6366F1',
  textDecoration: 'none',
});

globalStyle(`${MessageBody.classNames.base} a:hover`, {
  textDecoration: 'underline',
});

globalStyle(`${MessageBody.classNames.base} code`, {
  fontFamily: "'JetBrains Mono', monospace",
  fontSize: toRem(13),
  backgroundColor: 'rgba(255, 255, 255, 0.08)',
  padding: `${toRem(2)} ${toRem(6)}`,
  borderRadius: toRem(4),
  color: '#EC4899',
});

globalStyle(`${MessageBody.classNames.base} pre`, {
  margin: `${toRem(8)} 0`,
  padding: toRem(16),
  backgroundColor: '#141415',
  borderRadius: toRem(8),
  border: '1px solid rgba(255, 255, 255, 0.06)',
  overflow: 'auto',
});

globalStyle(`${MessageBody.classNames.base} pre code`, {
  backgroundColor: 'transparent',
  padding: 0,
  color: '#FAFAFA',
});

globalStyle(`${MessageBody.classNames.base} blockquote`, {
  margin: `${toRem(8)} 0`,
  paddingLeft: toRem(16),
  borderLeft: `3px solid rgba(99, 102, 241, 0.5)`,
  color: '#A1A1A6',
});

globalStyle(`${MessageBody.classNames.base} ul, ${MessageBody.classNames.base} ol`, {
  margin: `${toRem(8)} 0`,
  paddingLeft: toRem(24),
});

globalStyle(`${MessageBody.classNames.base} li`, {
  marginBottom: toRem(4),
});

// ============================================================================
// MESSAGE ACTIONS (hover toolbar)
// ============================================================================

const slideUp = keyframes({
  '0%': {
    opacity: 0,
    transform: 'translateY(4px)',
  },
  '100%': {
    opacity: 1,
    transform: 'translateY(0)',
  },
});

export const MessageActions = style({
  position: 'absolute',
  top: toRem(-14),
  right: toRem(20),
  display: 'none',
  alignItems: 'center',
  gap: toRem(2),
  padding: toRem(4),
  backgroundColor: '#1C1C1E',
  borderRadius: toRem(8),
  boxShadow: '0 4px 12px rgba(0, 0, 0, 0.5)',
  animation: `${slideUp} 100ms ease`,
  zIndex: 10,

  selectors: {
    '*:hover > &': {
      display: 'flex',
    },
  },
});

export const MessageActionButton = recipe({
  base: [
    DefaultReset,
    {
      width: toRem(28),
      height: toRem(28),
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: toRem(6),
      cursor: 'pointer',
      color: '#A1A1A6',
      transition: 'all 50ms ease',

      selectors: {
        '&:hover': {
          backgroundColor: 'rgba(255, 255, 255, 0.08)',
          color: '#FAFAFA',
        },
      },
    },
  ],
  variants: {
    active: {
      true: {
        color: '#6366F1',
        backgroundColor: 'rgba(99, 102, 241, 0.15)',

        selectors: {
          '&:hover': {
            backgroundColor: 'rgba(99, 102, 241, 0.2)',
            color: '#818CF8',
          },
        },
      },
    },
    danger: {
      true: {
        selectors: {
          '&:hover': {
            backgroundColor: 'rgba(239, 68, 68, 0.15)',
            color: '#EF4444',
          },
        },
      },
    },
  },
});
export type MessageActionButtonVariants = RecipeVariants<typeof MessageActionButton>;

export const MessageActionIcon = style({
  width: toRem(16),
  height: toRem(16),
});

// ============================================================================
// REACTIONS
// ============================================================================

export const ReactionsContainer = style({
  display: 'flex',
  flexWrap: 'wrap',
  gap: toRem(6),
  marginTop: toRem(8),
});

export const ReactionChip = recipe({
  base: [
    DefaultReset,
    {
      display: 'inline-flex',
      alignItems: 'center',
      gap: toRem(6),
      padding: `${toRem(4)} ${toRem(10)}`,
      backgroundColor: 'rgba(255, 255, 255, 0.04)',
      borderRadius: toRem(16),
      cursor: 'pointer',
      transition: 'all 100ms ease',
      border: '1px solid transparent',

      selectors: {
        '&:hover': {
          backgroundColor: 'rgba(255, 255, 255, 0.08)',
        },
      },
    },
  ],
  variants: {
    active: {
      true: {
        backgroundColor: 'rgba(99, 102, 241, 0.15)',
        borderColor: 'rgba(99, 102, 241, 0.3)',

        selectors: {
          '&:hover': {
            backgroundColor: 'rgba(99, 102, 241, 0.2)',
          },
        },
      },
    },
  },
  defaultVariants: {
    active: false,
  },
});
export type ReactionChipVariants = RecipeVariants<typeof ReactionChip>;

export const ReactionEmoji = style({
  fontSize: toRem(16),
  lineHeight: 1,
});

export const ReactionCount = style({
  fontSize: toRem(12),
  fontWeight: 500,
  color: '#A1A1A6',
});

// ============================================================================
// THREAD REPLY INDICATOR
// ============================================================================

export const ThreadIndicator = style([
  DefaultReset,
  {
    display: 'flex',
    alignItems: 'center',
    gap: toRem(8),
    marginTop: toRem(8),
    padding: `${toRem(8)} ${toRem(12)}`,
    backgroundColor: 'rgba(255, 255, 255, 0.02)',
    borderRadius: toRem(8),
    cursor: 'pointer',
    transition: 'all 100ms ease',
    color: '#6366F1',
    fontSize: toRem(13),
    fontWeight: 500,

    selectors: {
      '&:hover': {
        backgroundColor: 'rgba(99, 102, 241, 0.1)',
      },
    },
  },
]);

export const ThreadIndicatorAvatars = style({
  display: 'flex',
  marginLeft: toRem(-4),
});

export const ThreadIndicatorAvatar = style({
  width: toRem(20),
  height: toRem(20),
  borderRadius: toRem(5),
  border: '2px solid #0A0A0B',
  marginLeft: toRem(-6),
  overflow: 'hidden',

  selectors: {
    '&:first-child': {
      marginLeft: 0,
    },
  },
});

// ============================================================================
// AI RESPONSE CARD
// ============================================================================

export const AIResponseCard = style([
  DefaultReset,
  {
    marginTop: toRem(12),
    padding: toRem(16),
    backgroundColor: 'rgba(255, 255, 255, 0.02)',
    borderRadius: toRem(12),
    border: '1px solid rgba(255, 255, 255, 0.06)',
  },
]);

export const AIResponseHeader = style({
  display: 'flex',
  alignItems: 'center',
  gap: toRem(8),
  marginBottom: toRem(12),
  paddingBottom: toRem(12),
  borderBottom: '1px solid rgba(255, 255, 255, 0.04)',
});

export const AIResponseIcon = style({
  width: toRem(20),
  height: toRem(20),
  color: '#EC4899',
});

export const AIResponseTitle = style({
  fontSize: toRem(13),
  fontWeight: 600,
  color: '#FAFAFA',
});

export const AIResponseContent = style({
  fontSize: toRem(14),
  lineHeight: 1.6,
  color: '#E5E5E5',
});

export const AIResponseActions = style({
  display: 'flex',
  gap: toRem(8),
  marginTop: toRem(16),
  paddingTop: toRem(12),
  borderTop: '1px solid rgba(255, 255, 255, 0.04)',
});

export const AIResponseAction = recipe({
  base: [
    DefaultReset,
    {
      display: 'inline-flex',
      alignItems: 'center',
      gap: toRem(6),
      padding: `${toRem(6)} ${toRem(12)}`,
      backgroundColor: 'rgba(255, 255, 255, 0.04)',
      borderRadius: toRem(6),
      fontSize: toRem(12),
      fontWeight: 500,
      color: '#A1A1A6',
      cursor: 'pointer',
      transition: 'all 100ms ease',

      selectors: {
        '&:hover': {
          backgroundColor: 'rgba(255, 255, 255, 0.08)',
          color: '#FAFAFA',
        },
      },
    },
  ],
  variants: {
    primary: {
      true: {
        backgroundColor: '#6366F1',
        color: '#FFFFFF',

        selectors: {
          '&:hover': {
            backgroundColor: '#818CF8',
            color: '#FFFFFF',
          },
        },
      },
    },
  },
});
export type AIResponseActionVariants = RecipeVariants<typeof AIResponseAction>;

// ============================================================================
// FILE ATTACHMENT
// ============================================================================

export const FileAttachment = style([
  DefaultReset,
  {
    display: 'flex',
    alignItems: 'center',
    gap: toRem(12),
    marginTop: toRem(8),
    padding: toRem(12),
    backgroundColor: 'rgba(255, 255, 255, 0.02)',
    borderRadius: toRem(8),
    border: '1px solid rgba(255, 255, 255, 0.06)',
    cursor: 'pointer',
    transition: 'all 100ms ease',

    selectors: {
      '&:hover': {
        backgroundColor: 'rgba(255, 255, 255, 0.04)',
        borderColor: 'rgba(255, 255, 255, 0.1)',
      },
    },
  },
]);

export const FileAttachmentIcon = style({
  width: toRem(40),
  height: toRem(40),
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  backgroundColor: 'rgba(99, 102, 241, 0.15)',
  borderRadius: toRem(8),
  color: '#6366F1',
  flexShrink: 0,
});

export const FileAttachmentInfo = style({
  flex: 1,
  minWidth: 0,
});

export const FileAttachmentName = style({
  fontSize: toRem(14),
  fontWeight: 500,
  color: '#FAFAFA',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
});

export const FileAttachmentSize = style({
  fontSize: toRem(12),
  color: '#6E6E73',
  marginTop: toRem(2),
});

export const FileAttachmentDownload = style({
  width: toRem(32),
  height: toRem(32),
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  borderRadius: toRem(6),
  color: '#6E6E73',
  transition: 'all 100ms ease',

  selectors: {
    '&:hover': {
      backgroundColor: 'rgba(255, 255, 255, 0.08)',
      color: '#FAFAFA',
    },
  },
});

// ============================================================================
// IMAGE ATTACHMENT
// ============================================================================

export const ImageAttachment = style([
  DefaultReset,
  {
    marginTop: toRem(8),
    borderRadius: toRem(12),
    overflow: 'hidden',
    maxWidth: toRem(400),
    cursor: 'pointer',
    transition: 'transform 100ms ease',

    selectors: {
      '&:hover': {
        transform: 'scale(1.01)',
      },
    },
  },
]);

export const ImageAttachmentImg = style({
  display: 'block',
  maxWidth: '100%',
  height: 'auto',
});

// ============================================================================
// REPLY QUOTE
// ============================================================================

export const ReplyQuote = style([
  DefaultReset,
  {
    display: 'flex',
    alignItems: 'center',
    gap: toRem(8),
    marginBottom: toRem(8),
    padding: `${toRem(8)} ${toRem(12)}`,
    backgroundColor: 'rgba(255, 255, 255, 0.02)',
    borderRadius: toRem(8),
    borderLeft: '3px solid rgba(99, 102, 241, 0.5)',
    cursor: 'pointer',
    transition: 'all 100ms ease',

    selectors: {
      '&:hover': {
        backgroundColor: 'rgba(255, 255, 255, 0.04)',
      },
    },
  },
]);

export const ReplyQuoteAvatar = style({
  width: toRem(20),
  height: toRem(20),
  borderRadius: toRem(5),
  overflow: 'hidden',
  flexShrink: 0,
});

export const ReplyQuoteContent = style({
  flex: 1,
  minWidth: 0,
});

export const ReplyQuoteName = style({
  fontSize: toRem(12),
  fontWeight: 600,
  color: '#6366F1',
  marginRight: toRem(6),
});

export const ReplyQuoteText = style({
  fontSize: toRem(12),
  color: '#A1A1A6',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
});

// ============================================================================
// DATE DIVIDER
// ============================================================================

export const DateDivider = style({
  display: 'flex',
  alignItems: 'center',
  gap: toRem(16),
  padding: `${toRem(16)} ${toRem(20)}`,
});

export const DateDividerLine = style({
  flex: 1,
  height: '1px',
  backgroundColor: 'rgba(255, 255, 255, 0.06)',
});

export const DateDividerText = style({
  fontSize: toRem(11),
  fontWeight: 500,
  color: '#6E6E73',
  textTransform: 'uppercase',
  letterSpacing: '0.05em',
});

// ============================================================================
// UNREAD DIVIDER
// ============================================================================

export const UnreadDivider = style({
  display: 'flex',
  alignItems: 'center',
  gap: toRem(16),
  padding: `${toRem(8)} ${toRem(20)}`,
});

export const UnreadDividerLine = style({
  flex: 1,
  height: '1px',
  backgroundColor: '#EF4444',
});

export const UnreadDividerText = style({
  fontSize: toRem(11),
  fontWeight: 500,
  color: '#EF4444',
  textTransform: 'uppercase',
  letterSpacing: '0.05em',
});

// ============================================================================
// TYPING INDICATOR
// ============================================================================

const typing = keyframes({
  '0%, 60%, 100%': {
    transform: 'translateY(0)',
    opacity: 0.6,
  },
  '30%': {
    transform: 'translateY(-4px)',
    opacity: 1,
  },
});

export const TypingIndicator = style({
  display: 'flex',
  alignItems: 'center',
  gap: toRem(8),
  padding: `${toRem(8)} ${toRem(20)}`,
  color: '#6E6E73',
  fontSize: toRem(13),
});

export const TypingDots = style({
  display: 'flex',
  gap: toRem(3),
});

export const TypingDot = style({
  width: toRem(6),
  height: toRem(6),
  borderRadius: '50%',
  backgroundColor: '#6E6E73',
  animation: `${typing} 1.4s ease-in-out infinite`,

  selectors: {
    '&:nth-child(2)': {
      animationDelay: '0.2s',
    },
    '&:nth-child(3)': {
      animationDelay: '0.4s',
    },
  },
});
