/**
 * Revy Composer Styles
 * Premium message input design for Revy Comms
 *
 * Features:
 * - Auto-expanding textarea (1 line → max 12 lines)
 * - / triggers command palette (slash commands)
 * - @ triggers mention autocomplete
 * - AI prompt mode with ⌘J
 * - Drag-drop files anywhere
 * - Markdown preview
 * - ⌘⏎ to send (not Enter)
 */

import { style, keyframes, createVar, globalStyle } from '@vanilla-extract/css';
import { recipe, RecipeVariants } from '@vanilla-extract/recipes';
import { DefaultReset, toRem } from 'folds';

// ============================================================================
// COMPOSER CONTAINER
// ============================================================================

export const ComposerContainer = style([
  DefaultReset,
  {
    padding: `${toRem(12)} ${toRem(20)} ${toRem(16)}`,
    borderTop: '1px solid rgba(255, 255, 255, 0.06)',
    backgroundColor: '#0A0A0B',
  },
]);

// ============================================================================
// REPLY PREVIEW
// ============================================================================

export const ReplyPreview = style([
  DefaultReset,
  {
    display: 'flex',
    alignItems: 'center',
    gap: toRem(10),
    marginBottom: toRem(12),
    padding: `${toRem(8)} ${toRem(12)}`,
    backgroundColor: 'rgba(255, 255, 255, 0.02)',
    borderRadius: toRem(8),
    borderLeft: '3px solid #6366F1',
  },
]);

export const ReplyPreviewContent = style({
  flex: 1,
  minWidth: 0,
});

export const ReplyPreviewLabel = style({
  fontSize: toRem(11),
  fontWeight: 500,
  color: '#6366F1',
  marginBottom: toRem(2),
});

export const ReplyPreviewText = style({
  fontSize: toRem(13),
  color: '#A1A1A6',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
});

export const ReplyPreviewClose = style([
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

// ============================================================================
// INPUT WRAPPER
// ============================================================================

export const InputWrapper = recipe({
  base: [
    DefaultReset,
    {
      display: 'flex',
      flexDirection: 'column',
      backgroundColor: '#141415',
      borderRadius: toRem(12),
      border: '1px solid rgba(255, 255, 255, 0.06)',
      transition: 'all 150ms ease',

      selectors: {
        '&:focus-within': {
          backgroundColor: '#1A1A1B',
          borderColor: 'rgba(99, 102, 241, 0.5)',
          boxShadow: '0 0 0 3px rgba(99, 102, 241, 0.15)',
        },
      },
    },
  ],
  variants: {
    aiMode: {
      true: {
        borderColor: 'rgba(236, 72, 153, 0.5)',
        background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.05) 0%, rgba(236, 72, 153, 0.05) 100%)',

        selectors: {
          '&:focus-within': {
            borderColor: 'rgba(236, 72, 153, 0.6)',
            boxShadow: '0 0 0 3px rgba(236, 72, 153, 0.15)',
          },
        },
      },
    },
    dragOver: {
      true: {
        borderColor: '#6366F1',
        backgroundColor: 'rgba(99, 102, 241, 0.1)',
        borderStyle: 'dashed',
      },
    },
  },
  defaultVariants: {
    aiMode: false,
    dragOver: false,
  },
});
export type InputWrapperVariants = RecipeVariants<typeof InputWrapper>;

// ============================================================================
// AI MODE HEADER
// ============================================================================

export const AIModeHeader = style([
  DefaultReset,
  {
    display: 'flex',
    alignItems: 'center',
    gap: toRem(8),
    padding: `${toRem(10)} ${toRem(14)}`,
    borderBottom: '1px solid rgba(255, 255, 255, 0.04)',
    background: 'linear-gradient(90deg, rgba(99, 102, 241, 0.1) 0%, rgba(236, 72, 153, 0.1) 100%)',
  },
]);

export const AIModeIcon = style({
  width: toRem(16),
  height: toRem(16),
  color: '#EC4899',
});

export const AIModeTitle = style({
  fontSize: toRem(12),
  fontWeight: 600,
  background: 'linear-gradient(90deg, #6366F1 0%, #EC4899 100%)',
  WebkitBackgroundClip: 'text',
  WebkitTextFillColor: 'transparent',
  backgroundClip: 'text',
});

export const AIModeClose = style([
  DefaultReset,
  {
    marginLeft: 'auto',
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
        backgroundColor: 'rgba(255, 255, 255, 0.08)',
        color: '#FAFAFA',
      },
    },
  },
]);

// ============================================================================
// TEXTAREA
// ============================================================================

export const TextareaWrapper = style({
  position: 'relative',
  padding: `${toRem(12)} ${toRem(14)}`,
});

export const Textarea = style([
  DefaultReset,
  {
    width: '100%',
    minHeight: toRem(24),
    maxHeight: toRem(288), // 12 lines * 24px
    resize: 'none',
    backgroundColor: 'transparent',
    border: 'none',
    outline: 'none',
    fontSize: toRem(14),
    lineHeight: 1.6,
    color: '#FAFAFA',
    fontFamily: "'Inter', -apple-system, system-ui, sans-serif",

    '::placeholder': {
      color: '#6E6E73',
    },
  },
]);

export const TextareaPlaceholder = style({
  position: 'absolute',
  top: toRem(12),
  left: toRem(14),
  fontSize: toRem(14),
  color: '#6E6E73',
  pointerEvents: 'none',
});

// ============================================================================
// TOOLBAR
// ============================================================================

export const Toolbar = style([
  DefaultReset,
  {
    display: 'flex',
    alignItems: 'center',
    gap: toRem(4),
    padding: `${toRem(8)} ${toRem(10)}`,
    borderTop: '1px solid rgba(255, 255, 255, 0.04)',
  },
]);

export const ToolbarButton = recipe({
  base: [
    DefaultReset,
    {
      width: toRem(32),
      height: toRem(32),
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
  ],
  variants: {
    active: {
      true: {
        backgroundColor: 'rgba(99, 102, 241, 0.15)',
        color: '#6366F1',

        selectors: {
          '&:hover': {
            backgroundColor: 'rgba(99, 102, 241, 0.2)',
            color: '#818CF8',
          },
        },
      },
    },
    ai: {
      true: {
        background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.15) 0%, rgba(236, 72, 153, 0.15) 100%)',
        color: '#EC4899',

        selectors: {
          '&:hover': {
            background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.2) 0%, rgba(236, 72, 153, 0.2) 100%)',
            color: '#F472B6',
          },
        },
      },
    },
  },
  defaultVariants: {
    active: false,
    ai: false,
  },
});
export type ToolbarButtonVariants = RecipeVariants<typeof ToolbarButton>;

export const ToolbarIcon = style({
  width: toRem(18),
  height: toRem(18),
});

export const ToolbarDivider = style({
  width: '1px',
  height: toRem(20),
  backgroundColor: 'rgba(255, 255, 255, 0.06)',
  margin: `0 ${toRem(4)}`,
});

export const ToolbarSpacer = style({
  flex: 1,
});

export const ToolbarHint = style({
  display: 'flex',
  alignItems: 'center',
  gap: toRem(4),
  fontSize: toRem(11),
  color: '#6E6E73',
});

export const ToolbarKey = style({
  padding: `${toRem(2)} ${toRem(4)}`,
  backgroundColor: 'rgba(255, 255, 255, 0.06)',
  borderRadius: toRem(3),
  fontFamily: "'JetBrains Mono', monospace",
  fontSize: toRem(10),
});

// ============================================================================
// SEND BUTTON
// ============================================================================

export const SendButton = recipe({
  base: [
    DefaultReset,
    {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      gap: toRem(6),
      padding: `${toRem(8)} ${toRem(16)}`,
      borderRadius: toRem(8),
      cursor: 'pointer',
      fontSize: toRem(13),
      fontWeight: 500,
      transition: 'all 100ms ease',
    },
  ],
  variants: {
    variant: {
      default: {
        backgroundColor: '#6366F1',
        color: '#FFFFFF',

        selectors: {
          '&:hover': {
            backgroundColor: '#818CF8',
          },
          '&:disabled': {
            backgroundColor: 'rgba(99, 102, 241, 0.3)',
            color: 'rgba(255, 255, 255, 0.5)',
            cursor: 'not-allowed',
          },
        },
      },
      ai: {
        background: 'linear-gradient(135deg, #6366F1 0%, #EC4899 100%)',
        color: '#FFFFFF',

        selectors: {
          '&:hover': {
            background: 'linear-gradient(135deg, #818CF8 0%, #F472B6 100%)',
          },
          '&:disabled': {
            background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.3) 0%, rgba(236, 72, 153, 0.3) 100%)',
            color: 'rgba(255, 255, 255, 0.5)',
            cursor: 'not-allowed',
          },
        },
      },
    },
  },
  defaultVariants: {
    variant: 'default',
  },
});
export type SendButtonVariants = RecipeVariants<typeof SendButton>;

// ============================================================================
// AUTOCOMPLETE DROPDOWN
// ============================================================================

const slideDown = keyframes({
  '0%': {
    opacity: 0,
    transform: 'translateY(-8px)',
  },
  '100%': {
    opacity: 1,
    transform: 'translateY(0)',
  },
});

export const AutocompleteDropdown = style([
  DefaultReset,
  {
    position: 'absolute',
    bottom: 'calc(100% + 8px)',
    left: toRem(14),
    right: toRem(14),
    maxHeight: toRem(280),
    backgroundColor: '#1C1C1E',
    borderRadius: toRem(10),
    border: '1px solid rgba(255, 255, 255, 0.08)',
    boxShadow: '0 8px 24px rgba(0, 0, 0, 0.5)',
    overflow: 'hidden',
    animation: `${slideDown} 100ms ease`,
    zIndex: 100,
  },
]);

export const AutocompleteHeader = style({
  padding: `${toRem(10)} ${toRem(14)}`,
  borderBottom: '1px solid rgba(255, 255, 255, 0.04)',
  fontSize: toRem(11),
  fontWeight: 500,
  color: '#6E6E73',
  textTransform: 'uppercase',
  letterSpacing: '0.05em',
});

export const AutocompleteList = style({
  maxHeight: toRem(240),
  overflowY: 'auto',
  padding: toRem(4),

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
});

export const AutocompleteItem = recipe({
  base: [
    DefaultReset,
    {
      display: 'flex',
      alignItems: 'center',
      gap: toRem(10),
      padding: `${toRem(8)} ${toRem(10)}`,
      borderRadius: toRem(6),
      cursor: 'pointer',
      transition: 'all 50ms ease',
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
  },
  defaultVariants: {
    selected: false,
  },
});
export type AutocompleteItemVariants = RecipeVariants<typeof AutocompleteItem>;

export const AutocompleteItemIcon = recipe({
  base: {
    width: toRem(28),
    height: toRem(28),
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: toRem(6),
    flexShrink: 0,
    fontSize: toRem(12),
    fontWeight: 600,
  },
  variants: {
    variant: {
      user: {
        backgroundColor: '#6366F1',
        color: '#FFFFFF',
      },
      channel: {
        backgroundColor: 'rgba(99, 102, 241, 0.15)',
        color: '#6366F1',
      },
      command: {
        backgroundColor: 'rgba(245, 158, 11, 0.15)',
        color: '#F59E0B',
      },
      emoji: {
        backgroundColor: 'transparent',
        fontSize: toRem(20),
      },
    },
  },
  defaultVariants: {
    variant: 'user',
  },
});
export type AutocompleteItemIconVariants = RecipeVariants<typeof AutocompleteItemIcon>;

export const AutocompleteItemContent = style({
  flex: 1,
  minWidth: 0,
});

export const AutocompleteItemTitle = style({
  fontSize: toRem(14),
  fontWeight: 500,
  color: '#FAFAFA',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
});

export const AutocompleteItemDescription = style({
  fontSize: toRem(12),
  color: '#6E6E73',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
  marginTop: toRem(2),
});

export const AutocompleteItemShortcut = style({
  fontSize: toRem(11),
  color: '#6E6E73',
  fontFamily: "'JetBrains Mono', monospace",
  flexShrink: 0,
});

// ============================================================================
// FILE UPLOAD PREVIEW
// ============================================================================

export const FileUploadPreview = style([
  DefaultReset,
  {
    display: 'flex',
    flexWrap: 'wrap',
    gap: toRem(8),
    padding: `${toRem(12)} ${toRem(14)} 0`,
  },
]);

export const FileUploadItem = style([
  DefaultReset,
  {
    display: 'flex',
    alignItems: 'center',
    gap: toRem(8),
    padding: `${toRem(6)} ${toRem(10)}`,
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    borderRadius: toRem(8),
    border: '1px solid rgba(255, 255, 255, 0.06)',
  },
]);

export const FileUploadItemIcon = style({
  width: toRem(24),
  height: toRem(24),
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  backgroundColor: 'rgba(99, 102, 241, 0.15)',
  borderRadius: toRem(6),
  color: '#6366F1',
  flexShrink: 0,
});

export const FileUploadItemName = style({
  fontSize: toRem(13),
  color: '#FAFAFA',
  fontWeight: 500,
  maxWidth: toRem(150),
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
});

export const FileUploadItemSize = style({
  fontSize: toRem(11),
  color: '#6E6E73',
});

export const FileUploadItemRemove = style([
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
        backgroundColor: 'rgba(239, 68, 68, 0.15)',
        color: '#EF4444',
      },
    },
  },
]);

// ============================================================================
// IMAGE UPLOAD PREVIEW
// ============================================================================

export const ImageUploadPreview = style([
  DefaultReset,
  {
    position: 'relative',
    width: toRem(80),
    height: toRem(80),
    borderRadius: toRem(8),
    overflow: 'hidden',
  },
]);

export const ImageUploadPreviewImg = style({
  width: '100%',
  height: '100%',
  objectFit: 'cover',
});

export const ImageUploadPreviewRemove = style([
  DefaultReset,
  {
    position: 'absolute',
    top: toRem(4),
    right: toRem(4),
    width: toRem(20),
    height: toRem(20),
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    borderRadius: toRem(4),
    cursor: 'pointer',
    color: '#FAFAFA',
    transition: 'all 100ms ease',

    selectors: {
      '&:hover': {
        backgroundColor: '#EF4444',
      },
    },
  },
]);

// ============================================================================
// DRAG OVERLAY
// ============================================================================

export const DragOverlay = style([
  DefaultReset,
  {
    position: 'absolute',
    inset: 0,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(99, 102, 241, 0.1)',
    borderRadius: toRem(12),
    border: '2px dashed #6366F1',
    zIndex: 50,
  },
]);

export const DragOverlayIcon = style({
  width: toRem(40),
  height: toRem(40),
  color: '#6366F1',
  marginBottom: toRem(8),
});

export const DragOverlayText = style({
  fontSize: toRem(14),
  fontWeight: 500,
  color: '#6366F1',
});

// ============================================================================
// MARKDOWN TOGGLE
// ============================================================================

export const MarkdownToggle = style({
  display: 'flex',
  alignItems: 'center',
  gap: toRem(4),
  fontSize: toRem(11),
  color: '#6E6E73',
  cursor: 'pointer',
  transition: 'color 100ms ease',
  userSelect: 'none',

  selectors: {
    '&:hover': {
      color: '#A1A1A6',
    },
  },
});

export const MarkdownToggleIndicator = recipe({
  base: {
    width: toRem(8),
    height: toRem(8),
    borderRadius: '50%',
    transition: 'background-color 100ms ease',
  },
  variants: {
    active: {
      true: {
        backgroundColor: '#22C55E',
      },
      false: {
        backgroundColor: '#6E6E73',
      },
    },
  },
  defaultVariants: {
    active: false,
  },
});
export type MarkdownToggleIndicatorVariants = RecipeVariants<typeof MarkdownToggleIndicator>;
