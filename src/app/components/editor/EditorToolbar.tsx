import FocusTrap from 'focus-trap-react';
import type { IconSrc, RectCords } from 'folds';
import {
  Badge,
  Box,
  config,
  Icon,
  IconButton,
  Icons,
  Line,
  Menu,
  PopOut,
  Scroll,
  Text,
  Tooltip,
  toRem,
} from 'folds';
import type { MouseEventHandler, ReactNode, RefObject } from 'react';
import React, { useCallback, useEffect, useState } from 'react';
import * as css from './Editor.css';
import { useSetting } from '../../state/hooks/settings';
import { settingsAtom } from '../../state/settings';
import { useFormattedKeybind } from '../../state/hooks/keybinds';
import { KeybindAction } from '../../state/keybinds';
import { stopPropagation } from '../../utils/keyboard';
import { TooltipProvider } from '../TooltipProvider';
import type { EditorController } from './Editor';
import { domToMarkdown, domToMatrixCustomHTML, trimCustomHtml } from './editorOutput';
import {
  isBlockFormatActive,
  isCodeActive,
  isInlineMarkActive,
  isSpoilerActive,
  toggleBlockFormat,
  toggleCodeBlock,
  toggleExecFormat,
  toggleInlineCode,
  toggleInlineMark,
  toggleSpoiler,
} from './editorFormatting';

const preventFocusLoss = (e: React.MouseEvent | React.TouchEvent) => e.preventDefault();

const focusEndOfContent = (target: HTMLElement) => {
  target.focus();
  const range = document.createRange();
  range.selectNodeContents(target);
  range.collapse(false);
  const selection = window.getSelection();
  selection?.removeAllRanges();
  selection?.addRange(range);
};

type ToolbarTooltipProps = {
  text: string;
  keybind?: KeybindAction;
  shortCode?: string;
};

function ToolbarTooltip({ text, keybind, shortCode }: ToolbarTooltipProps) {
  const formatted = useFormattedKeybind(keybind);
  const code = formatted || shortCode;
  return (
    <Tooltip style={{ padding: config.space.S300 }}>
      <Box gap="200" direction="Column" alignItems="Center">
        <Text align="Center">{text}</Text>
        {code && (
          <Badge as="kbd" radii="300" size="500">
            <Text size="T200" align="Center">
              {code}
            </Text>
          </Badge>
        )}
      </Box>
    </Tooltip>
  );
}

type InlineButtonProps = {
  icon: IconSrc;
  tooltip: ReactNode;
  active: boolean;
  onClick: () => void;
  disabled?: boolean;
  testId?: string;
};

function InlineButton({ icon, tooltip, active, onClick, disabled, testId }: InlineButtonProps) {
  return (
    <TooltipProvider tooltip={tooltip}>
      {(triggerRef) => (
        <IconButton
          ref={triggerRef}
          className={active ? css.ToolbarButtonActive : undefined}
          variant="SurfaceVariant"
          onMouseDown={preventFocusLoss}
          onTouchStart={preventFocusLoss}
          onClick={onClick}
          aria-pressed={active}
          size="400"
          radii="300"
          disabled={disabled}
          data-testid={testId}
        >
          <Icon size="200" src={icon} />
        </IconButton>
      )}
    </TooltipProvider>
  );
}

type BlockButtonProps = {
  icon: IconSrc;
  tooltip: ReactNode;
  active: boolean;
  onClick: () => void;
  disabled?: boolean;
  testId?: string;
};

function BlockButton({ icon, tooltip, active, onClick, disabled, testId }: BlockButtonProps) {
  return (
    <TooltipProvider tooltip={tooltip}>
      {(triggerRef) => (
        <IconButton
          ref={triggerRef}
          className={active ? css.ToolbarButtonActive : undefined}
          variant="SurfaceVariant"
          onMouseDown={preventFocusLoss}
          onTouchStart={preventFocusLoss}
          onClick={onClick}
          aria-pressed={active}
          size="400"
          radii="300"
          disabled={disabled}
          data-testid={testId}
        >
          <Icon size="200" src={icon} />
        </IconButton>
      )}
    </TooltipProvider>
  );
}

type HeadingButtonProps = {
  inputRef: RefObject<HTMLDivElement | null>;
  onFormat: () => void;
  disabled?: boolean;
};

function HeadingButton({ inputRef, onFormat, disabled }: HeadingButtonProps) {
  const [anchor, setAnchor] = useState<RectCords>();
  const inputElement = inputRef.current;
  const activeLevel = inputElement
    ? (isBlockFormatActive(inputElement, 'h1') && 1) ||
      (isBlockFormatActive(inputElement, 'h2') && 2) ||
      (isBlockFormatActive(inputElement, 'h3') && 3) ||
      0
    : 0;
  const isActive = activeLevel > 0;

  const handleSelect = (tag: string) => {
    setAnchor(undefined);
    if (inputElement) {
      toggleBlockFormat(inputElement, tag);
      onFormat();
    }
  };

  const handleOpen: MouseEventHandler<HTMLButtonElement> = (evt) => {
    if (isActive && inputElement) {
      inputElement.focus();
      document.execCommand('formatBlock', false, 'div');
      onFormat();
      return;
    }
    setAnchor(evt.currentTarget.getBoundingClientRect());
  };

  return (
    <PopOut
      anchor={anchor}
      offset={5}
      position="Top"
      content={
        <FocusTrap
          focusTrapOptions={{
            initialFocus: false,
            onDeactivate: () => setAnchor(undefined),
            clickOutsideDeactivates: true,
            isKeyForward: (evt: KeyboardEvent) =>
              evt.key === 'ArrowDown' || evt.key === 'ArrowRight',
            isKeyBackward: (evt: KeyboardEvent) => evt.key === 'ArrowUp' || evt.key === 'ArrowLeft',
            escapeDeactivates: stopPropagation,
          }}
        >
          <Menu style={{ padding: config.space.S100 }}>
            <Box gap="100">
              <TooltipProvider
                tooltip={<ToolbarTooltip text="Heading 1" keybind={KeybindAction.FormatHeading1} />}
              >
                {(triggerRef) => (
                  <IconButton
                    ref={triggerRef}
                    onMouseDown={preventFocusLoss}
                    onTouchStart={preventFocusLoss}
                    onClick={() => handleSelect('h1')}
                    size="400"
                    radii="300"
                  >
                    <Icon size="200" src={Icons.Heading1} />
                  </IconButton>
                )}
              </TooltipProvider>
              <TooltipProvider
                tooltip={<ToolbarTooltip text="Heading 2" keybind={KeybindAction.FormatHeading2} />}
              >
                {(triggerRef) => (
                  <IconButton
                    ref={triggerRef}
                    onMouseDown={preventFocusLoss}
                    onTouchStart={preventFocusLoss}
                    onClick={() => handleSelect('h2')}
                    size="400"
                    radii="300"
                  >
                    <Icon size="200" src={Icons.Heading2} />
                  </IconButton>
                )}
              </TooltipProvider>
              <TooltipProvider
                tooltip={<ToolbarTooltip text="Heading 3" keybind={KeybindAction.FormatHeading3} />}
              >
                {(triggerRef) => (
                  <IconButton
                    ref={triggerRef}
                    onMouseDown={preventFocusLoss}
                    onTouchStart={preventFocusLoss}
                    onClick={() => handleSelect('h3')}
                    size="400"
                    radii="300"
                  >
                    <Icon size="200" src={Icons.Heading3} />
                  </IconButton>
                )}
              </TooltipProvider>
            </Box>
          </Menu>
        </FocusTrap>
      }
    >
      <IconButton
        className={isActive ? css.ToolbarButtonActive : undefined}
        style={{ width: 'unset' }}
        variant="SurfaceVariant"
        onMouseDown={preventFocusLoss}
        onClick={handleOpen}
        aria-pressed={isActive}
        size="400"
        radii="300"
        disabled={disabled}
      >
        {activeLevel ? (
          <Icon size="200" src={Icons[`Heading${activeLevel}` as keyof typeof Icons]} />
        ) : (
          <Text size="B400">H</Text>
        )}
        <Icon size="200" src={isActive ? Icons.Cross : Icons.ChevronBottom} />
      </IconButton>
    </PopOut>
  );
}

type EditorToolbarProps = {
  inputRef: RefObject<HTMLDivElement | null>;
  controllerRef?: RefObject<EditorController | null>;
  onFormat?: () => void;
};

export function EditorToolbar({ inputRef, controllerRef, onFormat }: EditorToolbarProps) {
  const [isMarkdownEnabled, setIsMarkdownEnabled] = useSetting(settingsAtom, 'isMarkdownEnabled');
  const [, setTick] = useState(0);

  const rerender = useCallback(() => {
    setTick((n) => n + 1);
    onFormat?.();
  }, [onFormat]);

  useEffect(() => {
    const inputElement = inputRef.current;
    if (!inputElement) return undefined;
    const sync = () => setTick((n) => n + 1);
    const syncOnSelection = () => {
      const selection = document.getSelection();
      if (
        selection &&
        selection.rangeCount > 0 &&
        inputElement.contains(selection.getRangeAt(0).startContainer)
      ) {
        sync();
      }
    };
    inputElement.addEventListener('input', sync);
    document.addEventListener('selectionchange', syncOnSelection);
    return () => {
      inputElement.removeEventListener('input', sync);
      document.removeEventListener('selectionchange', syncOnSelection);
    };
  }, [inputRef]);

  const inputElement = inputRef.current;
  const isInsideCodeBlock = inputElement ? isBlockFormatActive(inputElement, 'pre') : false;

  const applyFormat = useCallback(
    (fn: (target: HTMLElement) => void) => {
      const target = inputRef.current;
      if (!target) return;
      if (document.activeElement !== target) {
        focusEndOfContent(target);
      }
      fn(target);
      target.dispatchEvent(new Event('input', { bubbles: true }));
      rerender();
    },
    [inputRef, rerender]
  );

  const toggleMarkdown = () => {
    const target = inputRef.current;
    const controller = controllerRef?.current;

    if (target && controller && target.textContent) {
      const html = isMarkdownEnabled
        ? domToMarkdown(target)
        : trimCustomHtml(
            domToMatrixCustomHTML(target, {
              allowMarkdown: true,
            })
          );
      controller.setContent(html);
      focusEndOfContent(target);
    }

    setIsMarkdownEnabled(!isMarkdownEnabled);
    rerender();
  };

  return (
    <Box className={css.EditorToolbarBase}>
      <Scroll direction="Horizontal" size="0">
        <Box className={css.EditorToolbar} alignItems="Center" gap="300">
          <Box shrink="No" gap="100">
            <InlineButton
              icon={Icons.Bold}
              tooltip={<ToolbarTooltip text="Bold" keybind={KeybindAction.FormatBold} />}
              active={inputElement ? isInlineMarkActive(inputElement, 'bold') : false}
              onClick={() => applyFormat((target) => toggleInlineMark(target, 'bold'))}
              disabled={!isMarkdownEnabled || isInsideCodeBlock}
              testId="editor-toolbar-bold"
            />
            <InlineButton
              icon={Icons.Italic}
              tooltip={<ToolbarTooltip text="Italic" keybind={KeybindAction.FormatItalic} />}
              active={inputElement ? isInlineMarkActive(inputElement, 'italic') : false}
              onClick={() => applyFormat((target) => toggleInlineMark(target, 'italic'))}
              disabled={!isMarkdownEnabled || isInsideCodeBlock}
            />
            <InlineButton
              icon={Icons.Underline}
              tooltip={<ToolbarTooltip text="Underline" keybind={KeybindAction.FormatUnderline} />}
              active={inputElement ? isInlineMarkActive(inputElement, 'underline') : false}
              onClick={() => applyFormat((target) => toggleInlineMark(target, 'underline'))}
              disabled={!isMarkdownEnabled || isInsideCodeBlock}
            />
            <InlineButton
              icon={Icons.Strike}
              tooltip={
                <ToolbarTooltip text="Strike Through" keybind={KeybindAction.FormatStrikethrough} />
              }
              active={inputElement ? isInlineMarkActive(inputElement, 'strikeThrough') : false}
              onClick={() => applyFormat((target) => toggleInlineMark(target, 'strikeThrough'))}
              disabled={!isMarkdownEnabled || isInsideCodeBlock}
            />
            <InlineButton
              icon={Icons.Code}
              tooltip={
                <ToolbarTooltip text="Inline Code" keybind={KeybindAction.FormatInlineCode} />
              }
              active={inputElement ? isCodeActive(inputElement) : false}
              onClick={() => applyFormat(toggleInlineCode)}
              disabled={!isMarkdownEnabled || isInsideCodeBlock}
              testId="editor-toolbar-inline-code"
            />
            <InlineButton
              icon={Icons.EyeBlind}
              tooltip={<ToolbarTooltip text="Spoiler" keybind={KeybindAction.FormatSpoiler} />}
              active={inputElement ? isSpoilerActive(inputElement) : false}
              onClick={() => applyFormat(toggleSpoiler)}
              disabled={!isMarkdownEnabled || isInsideCodeBlock}
              testId="editor-toolbar-spoiler"
            />
          </Box>
          <Line variant="SurfaceVariant" direction="Vertical" style={{ height: toRem(12) }} />
          <Box shrink="No" gap="100">
            <BlockButton
              icon={Icons.BlockQuote}
              tooltip={
                <ToolbarTooltip text="Block Quote" keybind={KeybindAction.FormatBlockquote} />
              }
              active={inputElement ? isBlockFormatActive(inputElement, 'blockquote') : false}
              onClick={() => applyFormat((target) => toggleBlockFormat(target, 'blockquote'))}
              disabled={!isMarkdownEnabled}
            />
            <BlockButton
              icon={Icons.BlockCode}
              tooltip={<ToolbarTooltip text="Block Code" keybind={KeybindAction.FormatCodeBlock} />}
              active={inputElement ? isBlockFormatActive(inputElement, 'pre') : false}
              onClick={() => applyFormat(toggleCodeBlock)}
              disabled={!isMarkdownEnabled}
            />
            <BlockButton
              icon={Icons.OrderList}
              tooltip={
                <ToolbarTooltip text="Ordered List" keybind={KeybindAction.FormatOrderedList} />
              }
              active={inputElement ? isBlockFormatActive(inputElement, 'ol') : false}
              onClick={() => applyFormat(() => toggleExecFormat('insertOrderedList'))}
              disabled={!isMarkdownEnabled}
              testId="editor-toolbar-ordered-list"
            />
            <BlockButton
              icon={Icons.UnorderList}
              tooltip={
                <ToolbarTooltip text="Unordered List" keybind={KeybindAction.FormatUnorderedList} />
              }
              active={inputElement ? isBlockFormatActive(inputElement, 'ul') : false}
              onClick={() => applyFormat(() => toggleExecFormat('insertUnorderedList'))}
              disabled={!isMarkdownEnabled}
            />
            <HeadingButton inputRef={inputRef} onFormat={rerender} disabled={!isMarkdownEnabled} />
          </Box>
          <Box className={css.MarkdownBtnBox} shrink="No" grow="Yes" justifyContent="End">
            <TooltipProvider
              align="End"
              tooltip={
                <ToolbarTooltip text={isMarkdownEnabled ? 'Disable Markdown' : 'Enable Markdown'} />
              }
            >
              {(triggerRef) => (
                <IconButton
                  ref={triggerRef}
                  className={isMarkdownEnabled ? css.ToolbarButtonActive : undefined}
                  variant="SurfaceVariant"
                  onMouseDown={preventFocusLoss}
                  onTouchStart={preventFocusLoss}
                  onClick={toggleMarkdown}
                  aria-pressed={isMarkdownEnabled}
                  size="400"
                  radii="300"
                >
                  <Icon
                    className={isMarkdownEnabled ? undefined : css.MarkdownIconInactive}
                    size="200"
                    src={Icons.Markdown}
                  />
                </IconButton>
              )}
            </TooltipProvider>
            <span />
          </Box>
        </Box>
      </Scroll>
    </Box>
  );
}
