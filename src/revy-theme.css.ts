/**
 * Revy Comms Design System
 * A premium, AI-native team communication platform
 *
 * Design Philosophy:
 * - Speed is a feature, not a metric
 * - Hide protocol complexity ruthlessly
 * - Keyboard-first, mouse-optional
 * - Every pixel earns its place
 */

import { createTheme, style, globalStyle, createVar, keyframes } from '@vanilla-extract/css';
import { color, config } from 'folds';

// ============================================================================
// DESIGN TOKENS - CSS Custom Properties
// ============================================================================

// Color System - Dark Mode (Primary)
export const revyVars = {
  // Background colors
  bgPrimary: createVar(),
  bgSecondary: createVar(),
  bgTertiary: createVar(),
  bgHover: createVar(),
  bgActive: createVar(),

  // Text colors
  textPrimary: createVar(),
  textSecondary: createVar(),
  textTertiary: createVar(),
  textInverse: createVar(),

  // Accent colors
  accentPrimary: createVar(),
  accentPrimaryHover: createVar(),
  accentSuccess: createVar(),
  accentWarning: createVar(),
  accentDanger: createVar(),

  // Border colors
  borderSubtle: createVar(),
  borderVisible: createVar(),
  borderFocus: createVar(),

  // Shadows
  shadowSm: createVar(),
  shadowMd: createVar(),
  shadowLg: createVar(),
  shadowGlow: createVar(),

  // Spacing
  space1: createVar(),
  space2: createVar(),
  space3: createVar(),
  space4: createVar(),
  space5: createVar(),
  space6: createVar(),
  space8: createVar(),
  space10: createVar(),
  space12: createVar(),
  space16: createVar(),

  // Border radius
  radiusSm: createVar(),
  radiusMd: createVar(),
  radiusLg: createVar(),
  radiusXl: createVar(),
  radiusFull: createVar(),

  // Typography
  fontSans: createVar(),
  fontMono: createVar(),

  // Animation
  durationInstant: createVar(),
  durationFast: createVar(),
  durationNormal: createVar(),
  durationSlow: createVar(),
  easeOut: createVar(),
  easeInOut: createVar(),
  easeSpring: createVar(),

  // Layout
  navRailWidth: createVar(),
  channelListWidth: createVar(),
  contextPanelWidth: createVar(),
};

// Dark theme values
const darkThemeValues = {
  // Backgrounds
  [revyVars.bgPrimary]: '#0A0A0B',
  [revyVars.bgSecondary]: '#141415',
  [revyVars.bgTertiary]: '#1C1C1E',
  [revyVars.bgHover]: '#232326',
  [revyVars.bgActive]: '#2A2A2E',

  // Text
  [revyVars.textPrimary]: '#FAFAFA',
  [revyVars.textSecondary]: '#A1A1A6',
  [revyVars.textTertiary]: '#6E6E73',
  [revyVars.textInverse]: '#0A0A0B',

  // Accents
  [revyVars.accentPrimary]: '#6366F1',
  [revyVars.accentPrimaryHover]: '#818CF8',
  [revyVars.accentSuccess]: '#22C55E',
  [revyVars.accentWarning]: '#F59E0B',
  [revyVars.accentDanger]: '#EF4444',

  // Borders
  [revyVars.borderSubtle]: 'rgba(255,255,255,0.06)',
  [revyVars.borderVisible]: 'rgba(255,255,255,0.12)',
  [revyVars.borderFocus]: 'rgba(99,102,241,0.5)',

  // Shadows
  [revyVars.shadowSm]: '0 1px 2px rgba(0,0,0,0.4)',
  [revyVars.shadowMd]: '0 4px 12px rgba(0,0,0,0.5)',
  [revyVars.shadowLg]: '0 12px 40px rgba(0,0,0,0.6)',
  [revyVars.shadowGlow]: '0 0 20px rgba(99,102,241,0.3)',

  // Spacing
  [revyVars.space1]: '4px',
  [revyVars.space2]: '8px',
  [revyVars.space3]: '12px',
  [revyVars.space4]: '16px',
  [revyVars.space5]: '20px',
  [revyVars.space6]: '24px',
  [revyVars.space8]: '32px',
  [revyVars.space10]: '40px',
  [revyVars.space12]: '48px',
  [revyVars.space16]: '64px',

  // Radius
  [revyVars.radiusSm]: '4px',
  [revyVars.radiusMd]: '8px',
  [revyVars.radiusLg]: '12px',
  [revyVars.radiusXl]: '16px',
  [revyVars.radiusFull]: '9999px',

  // Typography
  [revyVars.fontSans]: "'Inter', -apple-system, system-ui, sans-serif",
  [revyVars.fontMono]: "'JetBrains Mono', 'Fira Code', monospace",

  // Animation
  [revyVars.durationInstant]: '50ms',
  [revyVars.durationFast]: '100ms',
  [revyVars.durationNormal]: '200ms',
  [revyVars.durationSlow]: '300ms',
  [revyVars.easeOut]: 'cubic-bezier(0.16, 1, 0.3, 1)',
  [revyVars.easeInOut]: 'cubic-bezier(0.65, 0, 0.35, 1)',
  [revyVars.easeSpring]: 'cubic-bezier(0.34, 1.56, 0.64, 1)',

  // Layout
  [revyVars.navRailWidth]: '56px',
  [revyVars.channelListWidth]: '240px',
  [revyVars.contextPanelWidth]: '320px',
};

// Light theme values
const lightThemeValues = {
  // Backgrounds
  [revyVars.bgPrimary]: '#FFFFFF',
  [revyVars.bgSecondary]: '#F9FAFB',
  [revyVars.bgTertiary]: '#F3F4F6',
  [revyVars.bgHover]: '#E5E7EB',
  [revyVars.bgActive]: '#D1D5DB',

  // Text
  [revyVars.textPrimary]: '#111827',
  [revyVars.textSecondary]: '#6B7280',
  [revyVars.textTertiary]: '#9CA3AF',
  [revyVars.textInverse]: '#FFFFFF',

  // Accents (same as dark)
  [revyVars.accentPrimary]: '#6366F1',
  [revyVars.accentPrimaryHover]: '#4F46E5',
  [revyVars.accentSuccess]: '#22C55E',
  [revyVars.accentWarning]: '#F59E0B',
  [revyVars.accentDanger]: '#EF4444',

  // Borders
  [revyVars.borderSubtle]: 'rgba(0,0,0,0.06)',
  [revyVars.borderVisible]: 'rgba(0,0,0,0.12)',
  [revyVars.borderFocus]: 'rgba(99,102,241,0.5)',

  // Shadows
  [revyVars.shadowSm]: '0 1px 2px rgba(0,0,0,0.05)',
  [revyVars.shadowMd]: '0 4px 12px rgba(0,0,0,0.1)',
  [revyVars.shadowLg]: '0 12px 40px rgba(0,0,0,0.15)',
  [revyVars.shadowGlow]: '0 0 20px rgba(99,102,241,0.2)',

  // Spacing (same as dark)
  [revyVars.space1]: '4px',
  [revyVars.space2]: '8px',
  [revyVars.space3]: '12px',
  [revyVars.space4]: '16px',
  [revyVars.space5]: '20px',
  [revyVars.space6]: '24px',
  [revyVars.space8]: '32px',
  [revyVars.space10]: '40px',
  [revyVars.space12]: '48px',
  [revyVars.space16]: '64px',

  // Radius (same as dark)
  [revyVars.radiusSm]: '4px',
  [revyVars.radiusMd]: '8px',
  [revyVars.radiusLg]: '12px',
  [revyVars.radiusXl]: '16px',
  [revyVars.radiusFull]: '9999px',

  // Typography (same as dark)
  [revyVars.fontSans]: "'Inter', -apple-system, system-ui, sans-serif",
  [revyVars.fontMono]: "'JetBrains Mono', 'Fira Code', monospace",

  // Animation (same as dark)
  [revyVars.durationInstant]: '50ms',
  [revyVars.durationFast]: '100ms',
  [revyVars.durationNormal]: '200ms',
  [revyVars.durationSlow]: '300ms',
  [revyVars.easeOut]: 'cubic-bezier(0.16, 1, 0.3, 1)',
  [revyVars.easeInOut]: 'cubic-bezier(0.65, 0, 0.35, 1)',
  [revyVars.easeSpring]: 'cubic-bezier(0.34, 1.56, 0.64, 1)',

  // Layout (same as dark)
  [revyVars.navRailWidth]: '56px',
  [revyVars.channelListWidth]: '240px',
  [revyVars.contextPanelWidth]: '320px',
};

// ============================================================================
// THEME CLASSES
// ============================================================================

export const revyDarkTheme = style({
  vars: darkThemeValues,
});

export const revyLightTheme = style({
  vars: lightThemeValues,
});

// ============================================================================
// FOLDS THEME INTEGRATION - Map Revy colors to Folds color contract
// ============================================================================

export const revyDarkFoldsTheme = createTheme(color, {
  Background: {
    Container: '#0A0A0B',
    ContainerHover: '#141415',
    ContainerActive: '#1C1C1E',
    ContainerLine: 'rgba(255,255,255,0.06)',
    OnContainer: '#FAFAFA',
  },

  Surface: {
    Container: '#141415',
    ContainerHover: '#1C1C1E',
    ContainerActive: '#232326',
    ContainerLine: 'rgba(255,255,255,0.12)',
    OnContainer: '#FAFAFA',
  },

  SurfaceVariant: {
    Container: '#1C1C1E',
    ContainerHover: '#232326',
    ContainerActive: '#2A2A2E',
    ContainerLine: 'rgba(255,255,255,0.12)',
    OnContainer: '#FAFAFA',
  },

  Primary: {
    Main: '#6366F1',
    MainHover: '#818CF8',
    MainActive: '#A5B4FC',
    MainLine: '#4F46E5',
    OnMain: '#FFFFFF',
    Container: '#312E81',
    ContainerHover: '#3730A3',
    ContainerActive: '#4338CA',
    ContainerLine: '#4F46E5',
    OnContainer: '#E0E7FF',
  },

  Secondary: {
    Main: '#FAFAFA',
    MainHover: '#E5E5E5',
    MainActive: '#D4D4D4',
    MainLine: '#A3A3A3',
    OnMain: '#0A0A0B',
    Container: '#262626',
    ContainerHover: '#333333',
    ContainerActive: '#404040',
    ContainerLine: '#525252',
    OnContainer: '#FAFAFA',
  },

  Success: {
    Main: '#22C55E',
    MainHover: '#16A34A',
    MainActive: '#15803D',
    MainLine: '#14532D',
    OnMain: '#FFFFFF',
    Container: '#14532D',
    ContainerHover: '#166534',
    ContainerActive: '#15803D',
    ContainerLine: '#16A34A',
    OnContainer: '#BBF7D0',
  },

  Warning: {
    Main: '#F59E0B',
    MainHover: '#D97706',
    MainActive: '#B45309',
    MainLine: '#92400E',
    OnMain: '#FFFFFF',
    Container: '#78350F',
    ContainerHover: '#92400E',
    ContainerActive: '#B45309',
    ContainerLine: '#D97706',
    OnContainer: '#FEF3C7',
  },

  Critical: {
    Main: '#EF4444',
    MainHover: '#DC2626',
    MainActive: '#B91C1C',
    MainLine: '#991B1B',
    OnMain: '#FFFFFF',
    Container: '#7F1D1D',
    ContainerHover: '#991B1B',
    ContainerActive: '#B91C1C',
    ContainerLine: '#DC2626',
    OnContainer: '#FEE2E2',
  },

  Other: {
    FocusRing: 'rgba(99, 102, 241, 0.5)',
    Shadow: 'rgba(0, 0, 0, 0.6)',
    Overlay: 'rgba(0, 0, 0, 0.8)',
  },
});

export const revyLightFoldsTheme = createTheme(color, {
  Background: {
    Container: '#FFFFFF',
    ContainerHover: '#F9FAFB',
    ContainerActive: '#F3F4F6',
    ContainerLine: 'rgba(0,0,0,0.06)',
    OnContainer: '#111827',
  },

  Surface: {
    Container: '#F9FAFB',
    ContainerHover: '#F3F4F6',
    ContainerActive: '#E5E7EB',
    ContainerLine: 'rgba(0,0,0,0.12)',
    OnContainer: '#111827',
  },

  SurfaceVariant: {
    Container: '#F3F4F6',
    ContainerHover: '#E5E7EB',
    ContainerActive: '#D1D5DB',
    ContainerLine: 'rgba(0,0,0,0.12)',
    OnContainer: '#111827',
  },

  Primary: {
    Main: '#6366F1',
    MainHover: '#4F46E5',
    MainActive: '#4338CA',
    MainLine: '#3730A3',
    OnMain: '#FFFFFF',
    Container: '#E0E7FF',
    ContainerHover: '#C7D2FE',
    ContainerActive: '#A5B4FC',
    ContainerLine: '#818CF8',
    OnContainer: '#312E81',
  },

  Secondary: {
    Main: '#111827',
    MainHover: '#1F2937',
    MainActive: '#374151',
    MainLine: '#4B5563',
    OnMain: '#FFFFFF',
    Container: '#E5E7EB',
    ContainerHover: '#D1D5DB',
    ContainerActive: '#9CA3AF',
    ContainerLine: '#6B7280',
    OnContainer: '#111827',
  },

  Success: {
    Main: '#22C55E',
    MainHover: '#16A34A',
    MainActive: '#15803D',
    MainLine: '#14532D',
    OnMain: '#FFFFFF',
    Container: '#DCFCE7',
    ContainerHover: '#BBF7D0',
    ContainerActive: '#86EFAC',
    ContainerLine: '#4ADE80',
    OnContainer: '#14532D',
  },

  Warning: {
    Main: '#F59E0B',
    MainHover: '#D97706',
    MainActive: '#B45309',
    MainLine: '#92400E',
    OnMain: '#FFFFFF',
    Container: '#FEF3C7',
    ContainerHover: '#FDE68A',
    ContainerActive: '#FCD34D',
    ContainerLine: '#FBBF24',
    OnContainer: '#78350F',
  },

  Critical: {
    Main: '#EF4444',
    MainHover: '#DC2626',
    MainActive: '#B91C1C',
    MainLine: '#991B1B',
    OnMain: '#FFFFFF',
    Container: '#FEE2E2',
    ContainerHover: '#FECACA',
    ContainerActive: '#FCA5A5',
    ContainerLine: '#F87171',
    OnContainer: '#7F1D1D',
  },

  Other: {
    FocusRing: 'rgba(99, 102, 241, 0.5)',
    Shadow: 'rgba(0, 0, 0, 0.15)',
    Overlay: 'rgba(0, 0, 0, 0.5)',
  },
});

// ============================================================================
// KEYFRAME ANIMATIONS
// ============================================================================

export const fadeIn = keyframes({
  '0%': {
    opacity: 0,
    transform: 'translateY(4px)',
  },
  '100%': {
    opacity: 1,
    transform: 'translateY(0)',
  },
});

export const fadeOut = keyframes({
  '0%': {
    opacity: 1,
    transform: 'translateY(0)',
  },
  '100%': {
    opacity: 0,
    transform: 'translateY(4px)',
  },
});

export const scaleIn = keyframes({
  '0%': {
    opacity: 0,
    transform: 'scale(0.95)',
  },
  '100%': {
    opacity: 1,
    transform: 'scale(1)',
  },
});

export const scaleOut = keyframes({
  '0%': {
    opacity: 1,
    transform: 'scale(1)',
  },
  '100%': {
    opacity: 0,
    transform: 'scale(0.95)',
  },
});

export const slideInFromLeft = keyframes({
  '0%': {
    opacity: 0,
    transform: 'translateX(-100%)',
  },
  '100%': {
    opacity: 1,
    transform: 'translateX(0)',
  },
});

export const slideInFromRight = keyframes({
  '0%': {
    opacity: 0,
    transform: 'translateX(100%)',
  },
  '100%': {
    opacity: 1,
    transform: 'translateX(0)',
  },
});

export const shimmer = keyframes({
  '0%': {
    backgroundPosition: '-200% 0',
  },
  '100%': {
    backgroundPosition: '200% 0',
  },
});

// ============================================================================
// UTILITY STYLES
// ============================================================================

// Skeleton loading animation
export const skeleton = style({
  background: `linear-gradient(
    90deg,
    ${revyVars.bgTertiary} 25%,
    ${revyVars.bgHover} 50%,
    ${revyVars.bgTertiary} 75%
  )`,
  backgroundSize: '200% 100%',
  animation: `${shimmer} 1.5s ease-in-out infinite`,
  borderRadius: revyVars.radiusMd,
});

// Focus ring utility
export const focusRing = style({
  selectors: {
    '&:focus-visible': {
      outline: 'none',
      boxShadow: `0 0 0 2px ${revyVars.bgPrimary}, 0 0 0 4px ${revyVars.accentPrimary}`,
    },
  },
});

// Hover transition utility
export const hoverTransition = style({
  transition: `all ${revyVars.durationFast} ${revyVars.easeOut}`,
});

// ============================================================================
// TYPOGRAPHY CLASSES
// ============================================================================

export const textXs = style({
  fontSize: '11px',
  lineHeight: '1.4',
});

export const textSm = style({
  fontSize: '13px',
  lineHeight: '1.5',
});

export const textBase = style({
  fontSize: '14px',
  lineHeight: '1.6',
});

export const textLg = style({
  fontSize: '16px',
  lineHeight: '1.5',
});

export const textXl = style({
  fontSize: '20px',
  lineHeight: '1.4',
});

export const text2xl = style({
  fontSize: '24px',
  lineHeight: '1.3',
});

export const text3xl = style({
  fontSize: '32px',
  lineHeight: '1.2',
});

export const fontNormal = style({
  fontWeight: 400,
});

export const fontMedium = style({
  fontWeight: 500,
});

export const fontSemibold = style({
  fontWeight: 600,
});
