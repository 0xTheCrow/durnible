/**
 * Revy Layout Styles
 * Main app shell layout for Revy Comms
 *
 * Structure:
 * ┌─────────────────────────────────────────────────────────────────┐
 * │                                                                 │
 * ├────────┬──────────────────────────────────┬─────────────────────┤
 * │        │                                  │                     │
 * │  Nav   │         Message Area             │   Context Panel     │
 * │  Rail  │                                  │   (Collapsible)     │
 * │        │                                  │                     │
 * │  56px  │          Flexible                │      320px          │
 * │        │                                  │                     │
 * │        ├──────────────────────────────────┤                     │
 * │        │      Composer Area               │                     │
 * │        │         ~120px                   │                     │
 * └────────┴──────────────────────────────────┴─────────────────────┘
 */

import { style, keyframes, createVar } from '@vanilla-extract/css';
import { recipe, RecipeVariants } from '@vanilla-extract/recipes';
import { DefaultReset, toRem } from 'folds';

// ============================================================================
// CSS VARIABLES
// ============================================================================

const navRailWidth = '56px';
const channelListWidth = '240px';
const contextPanelWidth = '320px';

// ============================================================================
// ROOT LAYOUT
// ============================================================================

export const RevyRoot = style([
  DefaultReset,
  {
    width: '100%',
    height: '100%',
    display: 'flex',
    flexDirection: 'row',
    backgroundColor: '#0A0A0B',
    color: '#FAFAFA',
    fontFamily: "'Inter', -apple-system, system-ui, sans-serif",
    overflow: 'hidden',
  },
]);

// ============================================================================
// MAIN CONTENT AREA (between nav rail and context panel)
// ============================================================================

export const RevyMain = style([
  DefaultReset,
  {
    flex: 1,
    display: 'flex',
    flexDirection: 'row',
    overflow: 'hidden',
    minWidth: 0,
  },
]);

// ============================================================================
// CHANNEL LIST PANEL (expandable, 240px)
// ============================================================================

const slideIn = keyframes({
  '0%': {
    opacity: 0,
    transform: 'translateX(-20px)',
  },
  '100%': {
    opacity: 1,
    transform: 'translateX(0)',
  },
});

export const ChannelListPanel = recipe({
  base: [
    DefaultReset,
    {
      width: channelListWidth,
      minWidth: channelListWidth,
      height: '100%',
      backgroundColor: '#0F0F10',
      borderRight: '1px solid rgba(255, 255, 255, 0.06)',
      display: 'flex',
      flexDirection: 'column',
      overflow: 'hidden',
      animation: `${slideIn} 200ms cubic-bezier(0.16, 1, 0.3, 1)`,
    },
  ],
  variants: {
    collapsed: {
      true: {
        display: 'none',
      },
    },
  },
  defaultVariants: {
    collapsed: false,
  },
});
export type ChannelListPanelVariants = RecipeVariants<typeof ChannelListPanel>;

export const ChannelListHeader = style([
  DefaultReset,
  {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: `${toRem(16)} ${toRem(16)} ${toRem(12)}`,
    borderBottom: '1px solid rgba(255, 255, 255, 0.04)',
  },
]);

export const ChannelListTitle = style({
  fontSize: toRem(14),
  fontWeight: 600,
  color: '#FAFAFA',
});

export const ChannelListAction = style([
  DefaultReset,
  {
    width: toRem(28),
    height: toRem(28),
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: toRem(6),
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

export const ChannelListSearch = style([
  DefaultReset,
  {
    margin: `0 ${toRem(12)} ${toRem(12)}`,
    padding: `${toRem(8)} ${toRem(12)}`,
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    borderRadius: toRem(8),
    fontSize: toRem(13),
    color: '#6E6E73',
    display: 'flex',
    alignItems: 'center',
    gap: toRem(8),
    cursor: 'text',
    transition: 'all 100ms ease',

    selectors: {
      '&:hover': {
        backgroundColor: 'rgba(255, 255, 255, 0.06)',
      },
      '&:focus-within': {
        backgroundColor: 'rgba(255, 255, 255, 0.08)',
        outline: '2px solid rgba(99, 102, 241, 0.5)',
      },
    },
  },
]);

export const ChannelListSearchInput = style([
  DefaultReset,
  {
    flex: 1,
    backgroundColor: 'transparent',
    border: 'none',
    outline: 'none',
    color: '#FAFAFA',
    fontSize: toRem(13),

    '::placeholder': {
      color: '#6E6E73',
    },
  },
]);

export const ChannelListContent = style([
  DefaultReset,
  {
    flex: 1,
    overflowY: 'auto',
    overflowX: 'hidden',
    padding: `${toRem(4)} ${toRem(8)}`,

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
// CHANNEL ITEM
// ============================================================================

export const ChannelItem = recipe({
  base: [
    DefaultReset,
    {
      display: 'flex',
      alignItems: 'center',
      gap: toRem(10),
      padding: `${toRem(8)} ${toRem(12)}`,
      borderRadius: toRem(8),
      cursor: 'pointer',
      transition: 'all 50ms ease',
      outline: 'none',
      color: '#A1A1A6',
    },
  ],
  variants: {
    active: {
      true: {
        backgroundColor: 'rgba(99, 102, 241, 0.15)',
        color: '#FAFAFA',
      },
      false: {
        selectors: {
          '&:hover': {
            backgroundColor: 'rgba(255, 255, 255, 0.04)',
            color: '#FAFAFA',
          },
        },
      },
    },
    unread: {
      true: {
        color: '#FAFAFA',
        fontWeight: 500,
      },
    },
    muted: {
      true: {
        opacity: 0.5,
      },
    },
  },
  defaultVariants: {
    active: false,
    unread: false,
    muted: false,
  },
});
export type ChannelItemVariants = RecipeVariants<typeof ChannelItem>;

export const ChannelItemIcon = style({
  width: toRem(18),
  height: toRem(18),
  flexShrink: 0,
  opacity: 0.7,
});

export const ChannelItemName = style({
  flex: 1,
  fontSize: toRem(14),
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
});

export const ChannelItemBadge = style([
  DefaultReset,
  {
    minWidth: toRem(18),
    height: toRem(18),
    padding: `0 ${toRem(5)}`,
    backgroundColor: '#6366F1',
    borderRadius: toRem(9),
    fontSize: toRem(11),
    fontWeight: 600,
    color: '#FFFFFF',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
]);

export const ChannelItemIndicator = style({
  width: toRem(8),
  height: toRem(8),
  backgroundColor: '#6366F1',
  borderRadius: '50%',
  flexShrink: 0,
});

// ============================================================================
// CHANNEL SECTION (collapsible)
// ============================================================================

export const ChannelSection = style([
  DefaultReset,
  {
    marginBottom: toRem(8),
  },
]);

export const ChannelSectionHeader = style([
  DefaultReset,
  {
    display: 'flex',
    alignItems: 'center',
    gap: toRem(4),
    padding: `${toRem(8)} ${toRem(8)}`,
    cursor: 'pointer',
    color: '#6E6E73',
    fontSize: toRem(11),
    fontWeight: 500,
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
    transition: 'color 100ms ease',

    selectors: {
      '&:hover': {
        color: '#A1A1A6',
      },
    },
  },
]);

export const ChannelSectionChevron = recipe({
  base: {
    width: toRem(14),
    height: toRem(14),
    transition: 'transform 150ms ease',
  },
  variants: {
    collapsed: {
      true: {
        transform: 'rotate(-90deg)',
      },
    },
  },
});
export type ChannelSectionChevronVariants = RecipeVariants<typeof ChannelSectionChevron>;

// ============================================================================
// MESSAGE AREA
// ============================================================================

export const MessageArea = style([
  DefaultReset,
  {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
    minWidth: 0,
    backgroundColor: '#0A0A0B',
  },
]);

export const MessageAreaHeader = style([
  DefaultReset,
  {
    display: 'flex',
    alignItems: 'center',
    gap: toRem(12),
    padding: `${toRem(12)} ${toRem(20)}`,
    borderBottom: '1px solid rgba(255, 255, 255, 0.06)',
    minHeight: toRem(56),
    flexShrink: 0,
  },
]);

export const MessageAreaHeaderIcon = style({
  width: toRem(20),
  height: toRem(20),
  color: '#6E6E73',
});

export const MessageAreaHeaderTitle = style({
  fontSize: toRem(15),
  fontWeight: 600,
  color: '#FAFAFA',
});

export const MessageAreaHeaderSubtitle = style({
  fontSize: toRem(13),
  color: '#6E6E73',
  marginLeft: toRem(8),
});

export const MessageAreaContent = style([
  DefaultReset,
  {
    flex: 1,
    overflow: 'hidden',
    display: 'flex',
    flexDirection: 'column',
  },
]);

// ============================================================================
// CONTEXT PANEL (right side, collapsible, 320px)
// ============================================================================

const slideInRight = keyframes({
  '0%': {
    opacity: 0,
    transform: 'translateX(20px)',
  },
  '100%': {
    opacity: 1,
    transform: 'translateX(0)',
  },
});

export const ContextPanel = recipe({
  base: [
    DefaultReset,
    {
      width: contextPanelWidth,
      minWidth: contextPanelWidth,
      height: '100%',
      backgroundColor: '#0F0F10',
      borderLeft: '1px solid rgba(255, 255, 255, 0.06)',
      display: 'flex',
      flexDirection: 'column',
      overflow: 'hidden',
      animation: `${slideInRight} 200ms cubic-bezier(0.16, 1, 0.3, 1)`,
    },
  ],
  variants: {
    collapsed: {
      true: {
        display: 'none',
      },
    },
  },
  defaultVariants: {
    collapsed: false,
  },
});
export type ContextPanelVariants = RecipeVariants<typeof ContextPanel>;

export const ContextPanelHeader = style([
  DefaultReset,
  {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: `${toRem(16)} ${toRem(16)}`,
    borderBottom: '1px solid rgba(255, 255, 255, 0.06)',
    minHeight: toRem(56),
  },
]);

export const ContextPanelTitle = style({
  fontSize: toRem(14),
  fontWeight: 600,
  color: '#FAFAFA',
});

export const ContextPanelClose = style([
  DefaultReset,
  {
    width: toRem(28),
    height: toRem(28),
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: toRem(6),
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

export const ContextPanelContent = style([
  DefaultReset,
  {
    flex: 1,
    overflowY: 'auto',
    overflowX: 'hidden',
    padding: toRem(16),

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
// CONTEXT PANEL SECTIONS
// ============================================================================

export const ContextSection = style([
  DefaultReset,
  {
    marginBottom: toRem(24),
  },
]);

export const ContextSectionTitle = style({
  fontSize: toRem(11),
  fontWeight: 500,
  color: '#6E6E73',
  textTransform: 'uppercase',
  letterSpacing: '0.05em',
  marginBottom: toRem(12),
});

export const ContextSectionContent = style({
  display: 'flex',
  flexDirection: 'column',
  gap: toRem(8),
});

// ============================================================================
// CONTEXT INFO ROW
// ============================================================================

export const ContextInfoRow = style([
  DefaultReset,
  {
    display: 'flex',
    alignItems: 'center',
    gap: toRem(10),
    padding: `${toRem(8)} ${toRem(12)}`,
    backgroundColor: 'rgba(255, 255, 255, 0.02)',
    borderRadius: toRem(8),
  },
]);

export const ContextInfoLabel = style({
  fontSize: toRem(12),
  color: '#6E6E73',
  flex: 1,
});

export const ContextInfoValue = style({
  fontSize: toRem(13),
  color: '#FAFAFA',
  fontWeight: 500,
});

// ============================================================================
// PARTICIPANT LIST
// ============================================================================

export const ParticipantItem = style([
  DefaultReset,
  {
    display: 'flex',
    alignItems: 'center',
    gap: toRem(10),
    padding: `${toRem(8)} ${toRem(12)}`,
    borderRadius: toRem(8),
    cursor: 'pointer',
    transition: 'all 100ms ease',

    selectors: {
      '&:hover': {
        backgroundColor: 'rgba(255, 255, 255, 0.04)',
      },
    },
  },
]);

export const ParticipantAvatar = style({
  width: toRem(32),
  height: toRem(32),
  borderRadius: toRem(8),
  backgroundColor: '#6366F1',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  fontSize: toRem(12),
  fontWeight: 600,
  color: '#FFFFFF',
  flexShrink: 0,
  overflow: 'hidden',
});

export const ParticipantInfo = style({
  flex: 1,
  minWidth: 0,
});

export const ParticipantName = style({
  fontSize: toRem(13),
  fontWeight: 500,
  color: '#FAFAFA',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
});

export const ParticipantRole = style({
  fontSize: toRem(11),
  color: '#6E6E73',
});

// ============================================================================
// WELCOME / EMPTY STATE
// ============================================================================

export const WelcomeScreen = style([
  DefaultReset,
  {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: toRem(40),
    textAlign: 'center',
  },
]);

export const WelcomeLogo = style({
  width: toRem(64),
  height: toRem(64),
  marginBottom: toRem(24),
  color: '#6366F1',
});

export const WelcomeTitle = style({
  fontSize: toRem(24),
  fontWeight: 600,
  color: '#FAFAFA',
  marginBottom: toRem(8),
});

export const WelcomeSubtitle = style({
  fontSize: toRem(14),
  color: '#6E6E73',
  maxWidth: toRem(320),
  lineHeight: 1.6,
  marginBottom: toRem(24),
});

export const WelcomeShortcut = style([
  DefaultReset,
  {
    display: 'inline-flex',
    alignItems: 'center',
    gap: toRem(8),
    padding: `${toRem(12)} ${toRem(20)}`,
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    borderRadius: toRem(8),
    fontSize: toRem(13),
    color: '#A1A1A6',
    border: '1px solid rgba(255, 255, 255, 0.06)',
    cursor: 'pointer',
    transition: 'all 100ms ease',

    selectors: {
      '&:hover': {
        backgroundColor: 'rgba(255, 255, 255, 0.08)',
        borderColor: 'rgba(255, 255, 255, 0.12)',
      },
    },
  },
]);

export const WelcomeKey = style({
  padding: `${toRem(2)} ${toRem(6)}`,
  backgroundColor: 'rgba(255, 255, 255, 0.1)',
  borderRadius: toRem(4),
  fontSize: toRem(12),
  fontWeight: 500,
  fontFamily: "'JetBrains Mono', monospace",
});
