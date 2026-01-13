/**
 * Command Palette Styles
 * Superhuman-inspired command palette for Revy Comms
 */

import { style, keyframes, globalStyle, createVar } from '@vanilla-extract/css';
import { recipe, RecipeVariants } from '@vanilla-extract/recipes';
import { DefaultReset, toRem } from 'folds';

// ============================================================================
// ANIMATIONS
// ============================================================================

const backdropFadeIn = keyframes({
  '0%': {
    opacity: 0,
  },
  '100%': {
    opacity: 1,
  },
});

const backdropFadeOut = keyframes({
  '0%': {
    opacity: 1,
  },
  '100%': {
    opacity: 0,
  },
});

const paletteScaleIn = keyframes({
  '0%': {
    opacity: 0,
    transform: 'translate(-50%, -50%) scale(0.95)',
  },
  '100%': {
    opacity: 1,
    transform: 'translate(-50%, -50%) scale(1)',
  },
});

const paletteScaleOut = keyframes({
  '0%': {
    opacity: 1,
    transform: 'translate(-50%, -50%) scale(1)',
  },
  '100%': {
    opacity: 0,
    transform: 'translate(-50%, -50%) scale(0.95)',
  },
});

// ============================================================================
// OVERLAY / BACKDROP
// ============================================================================

export const CommandPaletteOverlay = recipe({
  base: [
    DefaultReset,
    {
      position: 'fixed',
      inset: 0,
      backgroundColor: 'rgba(0, 0, 0, 0.7)',
      backdropFilter: 'blur(4px)',
      zIndex: 9999,
      display: 'flex',
      alignItems: 'flex-start',
      justifyContent: 'center',
      paddingTop: '15vh',
    },
  ],
  variants: {
    state: {
      entering: {
        animation: `${backdropFadeIn} 150ms cubic-bezier(0.16, 1, 0.3, 1) forwards`,
      },
      entered: {
        opacity: 1,
      },
      exiting: {
        animation: `${backdropFadeOut} 100ms cubic-bezier(0.16, 1, 0.3, 1) forwards`,
      },
    },
  },
});
export type CommandPaletteOverlayVariants = RecipeVariants<typeof CommandPaletteOverlay>;

// ============================================================================
// MAIN CONTAINER
// ============================================================================

export const CommandPalette = recipe({
  base: [
    DefaultReset,
    {
      width: '100%',
      maxWidth: toRem(640),
      maxHeight: '70vh',
      backgroundColor: '#141415',
      borderRadius: toRem(12),
      boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.8), 0 0 0 1px rgba(255, 255, 255, 0.06)',
      overflow: 'hidden',
      display: 'flex',
      flexDirection: 'column',
    },
  ],
  variants: {
    state: {
      entering: {
        animation: `${paletteScaleIn} 150ms cubic-bezier(0.16, 1, 0.3, 1) forwards`,
      },
      entered: {
        opacity: 1,
        transform: 'scale(1)',
      },
      exiting: {
        animation: `${paletteScaleOut} 100ms cubic-bezier(0.16, 1, 0.3, 1) forwards`,
      },
    },
  },
});
export type CommandPaletteVariants = RecipeVariants<typeof CommandPalette>;

// ============================================================================
// SEARCH INPUT
// ============================================================================

export const CommandPaletteInputWrapper = style([
  DefaultReset,
  {
    display: 'flex',
    alignItems: 'center',
    padding: `${toRem(16)} ${toRem(20)}`,
    borderBottom: '1px solid rgba(255, 255, 255, 0.06)',
    gap: toRem(12),
  },
]);

export const CommandPaletteInputIcon = style({
  width: toRem(20),
  height: toRem(20),
  color: '#6E6E73',
  flexShrink: 0,
});

export const CommandPaletteInput = style([
  DefaultReset,
  {
    flex: 1,
    fontSize: toRem(16),
    fontWeight: 400,
    color: '#FAFAFA',
    backgroundColor: 'transparent',
    border: 'none',
    outline: 'none',

    '::placeholder': {
      color: '#6E6E73',
    },
  },
]);

export const CommandPaletteInputClear = style([
  DefaultReset,
  {
    width: toRem(20),
    height: toRem(20),
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: toRem(4),
    cursor: 'pointer',
    color: '#6E6E73',
    transition: 'all 100ms ease',

    selectors: {
      '&:hover': {
        backgroundColor: 'rgba(255, 255, 255, 0.06)',
        color: '#A1A1A6',
      },
    },
  },
]);

// ============================================================================
// RESULTS CONTAINER
// ============================================================================

export const CommandPaletteResults = style([
  DefaultReset,
  {
    flex: 1,
    overflowY: 'auto',
    overflowX: 'hidden',
    padding: `${toRem(8)} 0`,

    // Custom scrollbar
    scrollbarWidth: 'thin',
    scrollbarColor: 'rgba(255, 255, 255, 0.1) transparent',

    '::-webkit-scrollbar': {
      width: toRem(6),
    },
    '::-webkit-scrollbar-track': {
      background: 'transparent',
    },
    '::-webkit-scrollbar-thumb': {
      backgroundColor: 'rgba(255, 255, 255, 0.1)',
      borderRadius: toRem(3),
    },
  },
]);

// ============================================================================
// SECTION
// ============================================================================

export const CommandPaletteSection = style([
  DefaultReset,
  {
    marginBottom: toRem(8),
  },
]);

export const CommandPaletteSectionHeader = style([
  DefaultReset,
  {
    padding: `${toRem(8)} ${toRem(20)}`,
    fontSize: toRem(11),
    fontWeight: 500,
    color: '#6E6E73',
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
  },
]);

// ============================================================================
// ITEM
// ============================================================================

export const CommandPaletteItem = recipe({
  base: [
    DefaultReset,
    {
      display: 'flex',
      alignItems: 'center',
      gap: toRem(12),
      padding: `${toRem(10)} ${toRem(20)}`,
      cursor: 'pointer',
      transition: 'all 50ms ease',
      outline: 'none',
    },
  ],
  variants: {
    selected: {
      true: {
        backgroundColor: 'rgba(99, 102, 241, 0.15)',
      },
      false: {
        selectors: {
          '&:hover': {
            backgroundColor: 'rgba(255, 255, 255, 0.04)',
          },
        },
      },
    },
    disabled: {
      true: {
        opacity: 0.5,
        cursor: 'not-allowed',
      },
    },
  },
  defaultVariants: {
    selected: false,
    disabled: false,
  },
});
export type CommandPaletteItemVariants = RecipeVariants<typeof CommandPaletteItem>;

export const CommandPaletteItemIcon = recipe({
  base: [
    DefaultReset,
    {
      width: toRem(32),
      height: toRem(32),
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: toRem(8),
      flexShrink: 0,
      fontSize: toRem(14),
    },
  ],
  variants: {
    variant: {
      default: {
        backgroundColor: 'rgba(255, 255, 255, 0.06)',
        color: '#A1A1A6',
      },
      channel: {
        backgroundColor: 'rgba(99, 102, 241, 0.15)',
        color: '#6366F1',
      },
      dm: {
        backgroundColor: 'rgba(34, 197, 94, 0.15)',
        color: '#22C55E',
      },
      ai: {
        backgroundColor: 'rgba(236, 72, 153, 0.15)',
        color: '#EC4899',
      },
      action: {
        backgroundColor: 'rgba(245, 158, 11, 0.15)',
        color: '#F59E0B',
      },
      danger: {
        backgroundColor: 'rgba(239, 68, 68, 0.15)',
        color: '#EF4444',
      },
    },
  },
  defaultVariants: {
    variant: 'default',
  },
});
export type CommandPaletteItemIconVariants = RecipeVariants<typeof CommandPaletteItemIcon>;

export const CommandPaletteItemContent = style({
  flex: 1,
  minWidth: 0,
});

export const CommandPaletteItemTitle = style({
  fontSize: toRem(14),
  fontWeight: 500,
  color: '#FAFAFA',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
});

export const CommandPaletteItemDescription = style({
  fontSize: toRem(12),
  color: '#6E6E73',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
  marginTop: toRem(2),
});

export const CommandPaletteItemShortcut = style({
  display: 'flex',
  alignItems: 'center',
  gap: toRem(4),
  flexShrink: 0,
});

export const CommandPaletteItemKey = style([
  DefaultReset,
  {
    padding: `${toRem(2)} ${toRem(6)}`,
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    borderRadius: toRem(4),
    fontSize: toRem(11),
    fontWeight: 500,
    color: '#6E6E73',
    fontFamily: "'JetBrains Mono', monospace",
    border: '1px solid rgba(255, 255, 255, 0.06)',
  },
]);

export const CommandPaletteItemBadge = style([
  DefaultReset,
  {
    padding: `${toRem(2)} ${toRem(6)}`,
    backgroundColor: '#EF4444',
    borderRadius: toRem(4),
    fontSize: toRem(10),
    fontWeight: 600,
    color: '#FFFFFF',
    flexShrink: 0,
  },
]);

// ============================================================================
// EMPTY STATE
// ============================================================================

export const CommandPaletteEmpty = style([
  DefaultReset,
  {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: `${toRem(40)} ${toRem(20)}`,
    textAlign: 'center',
  },
]);

export const CommandPaletteEmptyIcon = style({
  width: toRem(48),
  height: toRem(48),
  color: '#6E6E73',
  marginBottom: toRem(12),
});

export const CommandPaletteEmptyTitle = style({
  fontSize: toRem(14),
  fontWeight: 500,
  color: '#A1A1A6',
  marginBottom: toRem(4),
});

export const CommandPaletteEmptyDescription = style({
  fontSize: toRem(13),
  color: '#6E6E73',
});

// ============================================================================
// FOOTER
// ============================================================================

export const CommandPaletteFooter = style([
  DefaultReset,
  {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: toRem(16),
    padding: `${toRem(12)} ${toRem(20)}`,
    borderTop: '1px solid rgba(255, 255, 255, 0.06)',
    fontSize: toRem(11),
    color: '#6E6E73',
  },
]);

export const CommandPaletteFooterItem = style({
  display: 'flex',
  alignItems: 'center',
  gap: toRem(6),
});

export const CommandPaletteFooterKey = style([
  DefaultReset,
  {
    padding: `${toRem(2)} ${toRem(4)}`,
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    borderRadius: toRem(3),
    fontSize: toRem(10),
    fontFamily: "'JetBrains Mono', monospace",
  },
]);

// ============================================================================
// LOADING STATE
// ============================================================================

const shimmer = keyframes({
  '0%': {
    backgroundPosition: '-200% 0',
  },
  '100%': {
    backgroundPosition: '200% 0',
  },
});

export const CommandPaletteLoading = style([
  DefaultReset,
  {
    display: 'flex',
    flexDirection: 'column',
    gap: toRem(8),
    padding: `${toRem(12)} ${toRem(20)}`,
  },
]);

export const CommandPaletteLoadingItem = style({
  height: toRem(52),
  borderRadius: toRem(8),
  background: `linear-gradient(
    90deg,
    rgba(255, 255, 255, 0.04) 25%,
    rgba(255, 255, 255, 0.08) 50%,
    rgba(255, 255, 255, 0.04) 75%
  )`,
  backgroundSize: '200% 100%',
  animation: `${shimmer} 1.5s ease-in-out infinite`,
});

// ============================================================================
// HIGHLIGHT MATCH
// ============================================================================

export const CommandPaletteHighlight = style({
  backgroundColor: 'rgba(99, 102, 241, 0.3)',
  color: '#818CF8',
  borderRadius: toRem(2),
  padding: '0 1px',
});
