/**
 * Navigation Rail Styles
 * 56px icon-only vertical navigation - Revy Comms design
 */

import { style, keyframes, createVar } from '@vanilla-extract/css';
import { recipe, RecipeVariants } from '@vanilla-extract/recipes';
import { color, config, DefaultReset, toRem } from 'folds';

// ============================================================================
// CSS VARIABLES
// ============================================================================

const navRailWidth = '56px';
const itemSize = '40px';
const iconSize = '20px';

// ============================================================================
// NAVIGATION RAIL CONTAINER
// ============================================================================

export const NavRail = style([
  DefaultReset,
  {
    width: navRailWidth,
    minWidth: navRailWidth,
    height: '100%',
    backgroundColor: '#0A0A0B',
    borderRight: '1px solid rgba(255,255,255,0.06)',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    paddingTop: toRem(12),
    paddingBottom: toRem(12),
    gap: toRem(4),
    zIndex: 100,
    position: 'relative',
    flexShrink: 0,
  },
]);

// ============================================================================
// LOGO / BRAND
// ============================================================================

export const NavRailLogo = style([
  DefaultReset,
  {
    width: itemSize,
    height: itemSize,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: toRem(8),
    cursor: 'pointer',
    borderRadius: toRem(10),
    transition: 'all 100ms cubic-bezier(0.16, 1, 0.3, 1)',
    color: '#FAFAFA',

    selectors: {
      '&:hover': {
        backgroundColor: 'rgba(255,255,255,0.06)',
      },
    },
  },
]);

export const NavRailLogoIcon = style({
  width: toRem(28),
  height: toRem(28),
  color: '#6366F1',
});

// ============================================================================
// SECTION DIVIDER
// ============================================================================

export const NavRailDivider = style([
  DefaultReset,
  {
    width: toRem(24),
    height: '1px',
    backgroundColor: 'rgba(255,255,255,0.08)',
    margin: `${toRem(8)} 0`,
  },
]);

// ============================================================================
// SPACER
// ============================================================================

export const NavRailSpacer = style({
  flex: 1,
  minHeight: toRem(8),
});

// ============================================================================
// NAVIGATION ITEM
// ============================================================================

export const NavRailItem = recipe({
  base: [
    DefaultReset,
    {
      width: itemSize,
      height: itemSize,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: toRem(10),
      cursor: 'pointer',
      position: 'relative',
      transition: 'all 100ms cubic-bezier(0.16, 1, 0.3, 1)',
      color: '#A1A1A6',
      outline: 'none',

      selectors: {
        '&:hover': {
          backgroundColor: 'rgba(255,255,255,0.06)',
          color: '#FAFAFA',
        },
        '&:focus-visible': {
          boxShadow: '0 0 0 2px #0A0A0B, 0 0 0 4px #6366F1',
        },
      },
    },
  ],
  variants: {
    active: {
      true: {
        backgroundColor: 'rgba(99,102,241,0.15)',
        color: '#6366F1',

        selectors: {
          '&:hover': {
            backgroundColor: 'rgba(99,102,241,0.2)',
            color: '#818CF8',
          },
        },
      },
    },
    variant: {
      default: {},
      primary: {
        backgroundColor: '#6366F1',
        color: '#FFFFFF',

        selectors: {
          '&:hover': {
            backgroundColor: '#818CF8',
            color: '#FFFFFF',
          },
        },
      },
      danger: {
        selectors: {
          '&:hover': {
            backgroundColor: 'rgba(239,68,68,0.15)',
            color: '#EF4444',
          },
        },
      },
    },
  },
  defaultVariants: {
    active: false,
    variant: 'default',
  },
});
export type NavRailItemVariants = RecipeVariants<typeof NavRailItem>;

export const NavRailItemIcon = style({
  width: iconSize,
  height: iconSize,
  strokeWidth: '1.5px',
  flexShrink: 0,
});

// ============================================================================
// BADGE
// ============================================================================

export const NavRailBadge = recipe({
  base: [
    DefaultReset,
    {
      position: 'absolute',
      top: toRem(-2),
      right: toRem(-2),
      minWidth: toRem(8),
      height: toRem(8),
      borderRadius: toRem(4),
      backgroundColor: '#EF4444',
      border: '2px solid #0A0A0B',
      pointerEvents: 'none',
    },
  ],
  variants: {
    hasCount: {
      true: {
        minWidth: toRem(16),
        height: toRem(16),
        padding: `0 ${toRem(4)}`,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: toRem(10),
        fontWeight: 600,
        color: '#FFFFFF',
        top: toRem(-4),
        right: toRem(-4),
      },
    },
    variant: {
      default: {},
      success: {
        backgroundColor: '#22C55E',
      },
      warning: {
        backgroundColor: '#F59E0B',
      },
    },
  },
  defaultVariants: {
    hasCount: false,
    variant: 'default',
  },
});
export type NavRailBadgeVariants = RecipeVariants<typeof NavRailBadge>;

// ============================================================================
// TOOLTIP
// ============================================================================

const tooltipFadeIn = keyframes({
  '0%': {
    opacity: 0,
    transform: 'translateX(-4px)',
  },
  '100%': {
    opacity: 1,
    transform: 'translateX(0)',
  },
});

export const NavRailTooltip = style([
  DefaultReset,
  {
    position: 'absolute',
    left: 'calc(100% + 12px)',
    top: '50%',
    transform: 'translateY(-50%)',
    backgroundColor: '#1C1C1E',
    color: '#FAFAFA',
    padding: `${toRem(6)} ${toRem(10)}`,
    borderRadius: toRem(6),
    fontSize: toRem(12),
    fontWeight: 500,
    whiteSpace: 'nowrap',
    pointerEvents: 'none',
    zIndex: 1000,
    boxShadow: '0 4px 12px rgba(0,0,0,0.5)',
    animation: `${tooltipFadeIn} 100ms cubic-bezier(0.16, 1, 0.3, 1)`,
  },
]);

export const NavRailTooltipShortcut = style({
  marginLeft: toRem(8),
  padding: `${toRem(2)} ${toRem(4)}`,
  backgroundColor: 'rgba(255,255,255,0.1)',
  borderRadius: toRem(4),
  fontSize: toRem(10),
  color: '#A1A1A6',
  fontFamily: "'JetBrains Mono', monospace",
});

// ============================================================================
// USER AVATAR / PRESENCE
// ============================================================================

export const NavRailAvatar = recipe({
  base: [
    DefaultReset,
    {
      width: toRem(32),
      height: toRem(32),
      borderRadius: toRem(8),
      overflow: 'hidden',
      cursor: 'pointer',
      position: 'relative',
      transition: 'all 100ms cubic-bezier(0.16, 1, 0.3, 1)',

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
    size: 'md',
  },
});
export type NavRailAvatarVariants = RecipeVariants<typeof NavRailAvatar>;

export const NavRailAvatarImage = style({
  width: '100%',
  height: '100%',
  objectFit: 'cover',
});

export const NavRailPresence = recipe({
  base: [
    DefaultReset,
    {
      position: 'absolute',
      bottom: toRem(-2),
      right: toRem(-2),
      width: toRem(12),
      height: toRem(12),
      borderRadius: '50%',
      border: '2px solid #0A0A0B',
    },
  ],
  variants: {
    status: {
      online: {
        backgroundColor: '#22C55E',
      },
      away: {
        backgroundColor: '#F59E0B',
      },
      dnd: {
        backgroundColor: '#EF4444',
      },
      offline: {
        backgroundColor: '#6E6E73',
      },
    },
  },
  defaultVariants: {
    status: 'offline',
  },
});
export type NavRailPresenceVariants = RecipeVariants<typeof NavRailPresence>;

// ============================================================================
// COMMAND PALETTE TRIGGER (SPECIAL ITEM)
// ============================================================================

export const NavRailCommandTrigger = style([
  DefaultReset,
  {
    width: toRem(36),
    height: toRem(24),
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: toRem(6),
    cursor: 'pointer',
    fontSize: toRem(11),
    fontWeight: 500,
    color: '#6E6E73',
    fontFamily: "'JetBrains Mono', monospace",
    transition: 'all 100ms cubic-bezier(0.16, 1, 0.3, 1)',
    marginTop: toRem(4),
    marginBottom: toRem(4),

    selectors: {
      '&:hover': {
        backgroundColor: 'rgba(255,255,255,0.1)',
        color: '#A1A1A6',
      },
    },
  },
]);
