/**
 * Revy Toast Notification Styles
 * Premium notification toasts for Revy Comms
 *
 * Design:
 * - Slide in from top-right
 * - Auto-dismiss after 5 seconds
 * - Stack up to 3, then collapse to "+N more"
 * - Click to navigate to message
 * - Hover pauses auto-dismiss
 */

import { style, keyframes, createVar, globalStyle } from '@vanilla-extract/css';
import { recipe, RecipeVariants } from '@vanilla-extract/recipes';
import { DefaultReset, toRem } from 'folds';

// ============================================================================
// ANIMATIONS
// ============================================================================

const slideIn = keyframes({
  '0%': {
    opacity: 0,
    transform: 'translateX(100%)',
  },
  '100%': {
    opacity: 1,
    transform: 'translateX(0)',
  },
});

const slideOut = keyframes({
  '0%': {
    opacity: 1,
    transform: 'translateX(0)',
  },
  '100%': {
    opacity: 0,
    transform: 'translateX(100%)',
  },
});

// ============================================================================
// CONTAINER
// ============================================================================

export const ToastContainer = style([
  DefaultReset,
  {
    position: 'fixed',
    top: toRem(16),
    right: toRem(16),
    display: 'flex',
    flexDirection: 'column',
    gap: toRem(8),
    zIndex: 10000,
    maxWidth: toRem(400),
    pointerEvents: 'none',
  },
]);

// ============================================================================
// TOAST
// ============================================================================

export const Toast = recipe({
  base: [
    DefaultReset,
    {
      display: 'flex',
      gap: toRem(12),
      padding: toRem(14),
      backgroundColor: '#1C1C1E',
      borderRadius: toRem(12),
      border: '1px solid rgba(255, 255, 255, 0.08)',
      boxShadow: '0 8px 24px rgba(0, 0, 0, 0.5)',
      cursor: 'pointer',
      pointerEvents: 'auto',
      transition: 'all 150ms ease',
      animation: `${slideIn} 200ms cubic-bezier(0.16, 1, 0.3, 1)`,

      selectors: {
        '&:hover': {
          backgroundColor: '#232326',
          borderColor: 'rgba(255, 255, 255, 0.12)',
        },
      },
    },
  ],
  variants: {
    exiting: {
      true: {
        animation: `${slideOut} 150ms cubic-bezier(0.16, 1, 0.3, 1) forwards`,
      },
    },
    variant: {
      message: {},
      success: {
        borderLeftWidth: toRem(3),
        borderLeftStyle: 'solid',
        borderLeftColor: '#22C55E',
      },
      warning: {
        borderLeftWidth: toRem(3),
        borderLeftStyle: 'solid',
        borderLeftColor: '#F59E0B',
      },
      error: {
        borderLeftWidth: toRem(3),
        borderLeftStyle: 'solid',
        borderLeftColor: '#EF4444',
      },
      ai: {
        borderLeftWidth: toRem(3),
        borderLeftStyle: 'solid',
        borderLeftColor: '#EC4899',
      },
    },
  },
  defaultVariants: {
    exiting: false,
    variant: 'message',
  },
});
export type ToastVariants = RecipeVariants<typeof Toast>;

// ============================================================================
// AVATAR
// ============================================================================

export const ToastAvatar = recipe({
  base: [
    DefaultReset,
    {
      width: toRem(40),
      height: toRem(40),
      borderRadius: toRem(10),
      overflow: 'hidden',
      flexShrink: 0,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
    },
  ],
  variants: {
    variant: {
      user: {
        backgroundColor: '#6366F1',
        color: '#FFFFFF',
        fontSize: toRem(14),
        fontWeight: 600,
      },
      success: {
        backgroundColor: 'rgba(34, 197, 94, 0.15)',
        color: '#22C55E',
      },
      warning: {
        backgroundColor: 'rgba(245, 158, 11, 0.15)',
        color: '#F59E0B',
      },
      error: {
        backgroundColor: 'rgba(239, 68, 68, 0.15)',
        color: '#EF4444',
      },
      ai: {
        background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.15) 0%, rgba(236, 72, 153, 0.15) 100%)',
        color: '#EC4899',
      },
    },
  },
  defaultVariants: {
    variant: 'user',
  },
});
export type ToastAvatarVariants = RecipeVariants<typeof ToastAvatar>;

export const ToastAvatarImage = style({
  width: '100%',
  height: '100%',
  objectFit: 'cover',
});

export const ToastAvatarIcon = style({
  width: toRem(20),
  height: toRem(20),
});

// ============================================================================
// CONTENT
// ============================================================================

export const ToastContent = style({
  flex: 1,
  minWidth: 0,
});

export const ToastHeader = style({
  display: 'flex',
  alignItems: 'center',
  gap: toRem(8),
  marginBottom: toRem(4),
});

export const ToastTitle = style({
  fontSize: toRem(13),
  fontWeight: 600,
  color: '#FAFAFA',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
});

export const ToastSubtitle = style({
  fontSize: toRem(12),
  color: '#6E6E73',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
});

export const ToastMessage = style({
  fontSize: toRem(13),
  color: '#A1A1A6',
  lineHeight: 1.5,
  overflow: 'hidden',
  display: '-webkit-box',
  WebkitLineClamp: 2,
  WebkitBoxOrient: 'vertical',
});

// ============================================================================
// CLOSE BUTTON
// ============================================================================

export const ToastClose = style([
  DefaultReset,
  {
    width: toRem(24),
    height: toRem(24),
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: toRem(6),
    cursor: 'pointer',
    color: '#6E6E73',
    transition: 'all 100ms ease',
    flexShrink: 0,

    selectors: {
      '&:hover': {
        backgroundColor: 'rgba(255, 255, 255, 0.08)',
        color: '#FAFAFA',
      },
    },
  },
]);

export const ToastCloseIcon = style({
  width: toRem(14),
  height: toRem(14),
});

// ============================================================================
// ACTIONS
// ============================================================================

export const ToastActions = style({
  display: 'flex',
  gap: toRem(8),
  marginTop: toRem(10),
});

export const ToastAction = recipe({
  base: [
    DefaultReset,
    {
      display: 'inline-flex',
      alignItems: 'center',
      gap: toRem(6),
      padding: `${toRem(6)} ${toRem(12)}`,
      borderRadius: toRem(6),
      fontSize: toRem(12),
      fontWeight: 500,
      cursor: 'pointer',
      transition: 'all 100ms ease',
    },
  ],
  variants: {
    variant: {
      default: {
        backgroundColor: 'rgba(255, 255, 255, 0.06)',
        color: '#A1A1A6',

        selectors: {
          '&:hover': {
            backgroundColor: 'rgba(255, 255, 255, 0.1)',
            color: '#FAFAFA',
          },
        },
      },
      primary: {
        backgroundColor: '#6366F1',
        color: '#FFFFFF',

        selectors: {
          '&:hover': {
            backgroundColor: '#818CF8',
          },
        },
      },
    },
  },
  defaultVariants: {
    variant: 'default',
  },
});
export type ToastActionVariants = RecipeVariants<typeof ToastAction>;

// ============================================================================
// PROGRESS BAR
// ============================================================================

export const ToastProgress = style([
  DefaultReset,
  {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: toRem(3),
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    borderRadius: `0 0 ${toRem(12)} ${toRem(12)}`,
    overflow: 'hidden',
  },
]);

export const ToastProgressBar = recipe({
  base: {
    height: '100%',
    transition: 'width linear',
  },
  variants: {
    variant: {
      message: {
        backgroundColor: '#6366F1',
      },
      success: {
        backgroundColor: '#22C55E',
      },
      warning: {
        backgroundColor: '#F59E0B',
      },
      error: {
        backgroundColor: '#EF4444',
      },
      ai: {
        background: 'linear-gradient(90deg, #6366F1 0%, #EC4899 100%)',
      },
    },
  },
  defaultVariants: {
    variant: 'message',
  },
});
export type ToastProgressBarVariants = RecipeVariants<typeof ToastProgressBar>;

// ============================================================================
// STACKED INDICATOR
// ============================================================================

export const ToastStackIndicator = style([
  DefaultReset,
  {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: `${toRem(10)} ${toRem(14)}`,
    backgroundColor: '#141415',
    borderRadius: toRem(10),
    border: '1px solid rgba(255, 255, 255, 0.06)',
    fontSize: toRem(12),
    fontWeight: 500,
    color: '#6E6E73',
    cursor: 'pointer',
    pointerEvents: 'auto',
    transition: 'all 100ms ease',

    selectors: {
      '&:hover': {
        backgroundColor: '#1C1C1E',
        color: '#A1A1A6',
      },
    },
  },
]);
