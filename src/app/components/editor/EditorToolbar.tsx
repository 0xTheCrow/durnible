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
  TooltipProvider,
  toRem,
} from 'folds';
import type { MouseEventHandler, ReactNode, RefObject } from 'react';
import React, { useCallback, useEffect, useState } from 'react';
import * as css from './Editor.css';
import { isMacOS } from '../../utils/user-agent';
import { KeySymbol } from '../../utils/key-symbol';
import { useSetting } from '../../state/hooks/settings';
import { settingsAtom } from '../../state/settings';
import { stopPropagation } from '../../utils/keyboard';
import {
  exitBlock,
  isExitableBlock,
  isBlockFormatActive,
  isCodeActive,
  isFormatActive,
  isSpoilerActive,
  toggleBlockFormat,
  toggleCodeBlock,
  toggleExecFormat,
  toggleInlineCode,
  toggleSpoiler,
} from './editorFormatting';

const preventFocusLoss = (e: React.MouseEvent | React.TouchEvent) => e.preventDefault();

function BtnTooltip({ text, shortCode }: { text: string; shortCode?: string }) {
  return (
    <Tooltip style={{ padding: config.space.S300 }}>
      <Box gap="200" direction="Column" alignItems="Center">
        <Text align="Center">{text}</Text>
        {shortCode && (
          <Badge as="kbd" radii="300" size="500">
            <Text size="T200" align="Center">
              {shortCode}
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
};

function InlineButton({ icon, tooltip, active, onClick, disabled }: InlineButtonProps) {
  return (
    <TooltipProvider tooltip={tooltip} delay={500}>
      {(triggerRef) => (
        <IconButton
          ref={triggerRef}
          variant="SurfaceVariant"
          onMouseDown={preventFocusLoss}
          onTouchStart={preventFocusLoss}
          onClick={onClick}
          aria-pressed={active}
          size="400"
          radii="300"
          disabled={disabled}
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
};

function BlockButton({ icon, tooltip, active, onClick }: BlockButtonProps) {
  return (
    <TooltipProvider tooltip={tooltip} delay={500}>
      {(triggerRef) => (
        <IconButton
          ref={triggerRef}
          variant="SurfaceVariant"
          onMouseDown={preventFocusLoss}
          onTouchStart={preventFocusLoss}
          onClick={onClick}
          aria-pressed={active}
          size="400"
          radii="300"
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
};

function HeadingButton({ inputRef, onFormat }: HeadingButtonProps) {
  const [anchor, setAnchor] = useState<RectCords>();
  const el = inputRef.current;
  const activeLevel = el
    ? (isBlockFormatActive(el, 'h1') && 1) ||
      (isBlockFormatActive(el, 'h2') && 2) ||
      (isBlockFormatActive(el, 'h3') && 3) ||
      0
    : 0;
  const isActive = activeLevel > 0;
  const modKey = isMacOS() ? KeySymbol.Command : 'Ctrl';

  const handleSelect = (tag: string) => {
    setAnchor(undefined);
    if (el) {
      toggleBlockFormat(el, tag);
      onFormat();
    }
  };

  const handleOpen: MouseEventHandler<HTMLButtonElement> = (evt) => {
    if (isActive && el) {
      el.focus();
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
                tooltip={<BtnTooltip text="Heading 1" shortCode={`${modKey} + 1`} />}
                delay={500}
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
                tooltip={<BtnTooltip text="Heading 2" shortCode={`${modKey} + 2`} />}
                delay={500}
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
                tooltip={<BtnTooltip text="Heading 3" shortCode={`${modKey} + 3`} />}
                delay={500}
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
        style={{ width: 'unset' }}
        variant="SurfaceVariant"
        onMouseDown={preventFocusLoss}
        onClick={handleOpen}
        aria-pressed={isActive}
        size="400"
        radii="300"
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
  onFormat?: () => void;
};

export function EditorToolbar({ inputRef, onFormat }: EditorToolbarProps) {
  const modKey = isMacOS() ? KeySymbol.Command : 'Ctrl';
  const [isMarkdown, setIsMarkdown] = useSetting(settingsAtom, 'isMarkdown');
  const [, setTick] = useState(0);

  const rerender = useCallback(() => {
    setTick((n) => n + 1);
    onFormat?.();
  }, [onFormat]);

  useEffect(() => {
    const el = inputRef.current;
    if (!el) return undefined;
    const sync = () => setTick((n) => n + 1);
    el.addEventListener('input', sync);
    el.addEventListener('keyup', sync);
    return () => {
      el.removeEventListener('input', sync);
      el.removeEventListener('keyup', sync);
    };
  }, [inputRef]);

  const el = inputRef.current;
  const insideCode = el ? isBlockFormatActive(el, 'pre') : false;

  const applyFormat = useCallback(
    (fn: (target: HTMLElement) => void) => {
      const target = inputRef.current;
      if (!target) return;
      if (document.activeElement !== target) {
        target.focus();
        const range = document.createRange();
        range.selectNodeContents(target);
        range.collapse(false);
        const sel = window.getSelection();
        sel?.removeAllRanges();
        sel?.addRange(range);
      }
      fn(target);
      target.dispatchEvent(new Event('input', { bubbles: true }));
      rerender();
    },
    [inputRef, rerender]
  );

  return (
    <Box className={css.EditorToolbarBase}>
      <Scroll direction="Horizontal" size="0">
        <Box className={css.EditorToolbar} alignItems="Center" gap="300">
          <Box shrink="No" gap="100">
            <InlineButton
              icon={Icons.Bold}
              tooltip={<BtnTooltip text="Bold" shortCode={`${modKey} + B`} />}
              active={isFormatActive('bold')}
              onClick={() => applyFormat(() => toggleExecFormat('bold'))}
              disabled={insideCode}
            />
            <InlineButton
              icon={Icons.Italic}
              tooltip={<BtnTooltip text="Italic" shortCode={`${modKey} + I`} />}
              active={isFormatActive('italic')}
              onClick={() => applyFormat(() => toggleExecFormat('italic'))}
              disabled={insideCode}
            />
            <InlineButton
              icon={Icons.Underline}
              tooltip={<BtnTooltip text="Underline" shortCode={`${modKey} + U`} />}
              active={isFormatActive('underline')}
              onClick={() => applyFormat(() => toggleExecFormat('underline'))}
              disabled={insideCode}
            />
            <InlineButton
              icon={Icons.Strike}
              tooltip={<BtnTooltip text="Strike Through" shortCode={`${modKey} + S`} />}
              active={isFormatActive('strikeThrough')}
              onClick={() => applyFormat(() => toggleExecFormat('strikeThrough'))}
              disabled={insideCode}
            />
            <InlineButton
              icon={Icons.Code}
              tooltip={<BtnTooltip text="Inline Code" shortCode={`${modKey} + [`} />}
              active={el ? isCodeActive(el) : false}
              onClick={() => applyFormat(toggleInlineCode)}
              disabled={insideCode}
            />
            <InlineButton
              icon={Icons.EyeBlind}
              tooltip={<BtnTooltip text="Spoiler" shortCode={`${modKey} + H`} />}
              active={el ? isSpoilerActive(el) : false}
              onClick={() => applyFormat(toggleSpoiler)}
              disabled={insideCode}
            />
          </Box>
          <Line variant="SurfaceVariant" direction="Vertical" style={{ height: toRem(12) }} />
          <Box shrink="No" gap="100">
            <BlockButton
              icon={Icons.BlockQuote}
              tooltip={<BtnTooltip text="Block Quote" shortCode={`${modKey} + '`} />}
              active={el ? isBlockFormatActive(el, 'blockquote') : false}
              onClick={() => applyFormat((target) => toggleBlockFormat(target, 'blockquote'))}
            />
            <BlockButton
              icon={Icons.BlockCode}
              tooltip={<BtnTooltip text="Block Code" shortCode={`${modKey} + ;`} />}
              active={el ? isBlockFormatActive(el, 'pre') : false}
              onClick={() => applyFormat(toggleCodeBlock)}
            />
            <BlockButton
              icon={Icons.OrderList}
              tooltip={<BtnTooltip text="Ordered List" shortCode={`${modKey} + 7`} />}
              active={el ? isBlockFormatActive(el, 'ol') : false}
              onClick={() => applyFormat(() => toggleExecFormat('insertOrderedList'))}
            />
            <BlockButton
              icon={Icons.UnorderList}
              tooltip={<BtnTooltip text="Unordered List" shortCode={`${modKey} + 8`} />}
              active={el ? isBlockFormatActive(el, 'ul') : false}
              onClick={() => applyFormat(() => toggleExecFormat('insertUnorderedList'))}
            />
            <HeadingButton inputRef={inputRef} onFormat={rerender} />
          </Box>
          {el && isExitableBlock(el) && (
            <>
              <Line variant="SurfaceVariant" direction="Vertical" style={{ height: toRem(12) }} />
              <Box shrink="No" gap="100">
                <TooltipProvider
                  tooltip={
                    <BtnTooltip text="Exit Formatting" shortCode={`Escape, ${modKey} + E`} />
                  }
                  delay={500}
                >
                  {(triggerRef) => (
                    <IconButton
                      ref={triggerRef}
                      variant="SurfaceVariant"
                      onMouseDown={preventFocusLoss}
                      onTouchStart={preventFocusLoss}
                      onClick={() => applyFormat(exitBlock)}
                      size="400"
                      radii="300"
                    >
                      <Text size="B400">{`Exit ${KeySymbol.Hyper}`}</Text>
                    </IconButton>
                  )}
                </TooltipProvider>
              </Box>
            </>
          )}
          <Box className={css.MarkdownBtnBox} shrink="No" grow="Yes" justifyContent="End">
            <TooltipProvider
              align="End"
              tooltip={<BtnTooltip text={isMarkdown ? 'Disable Markdown' : 'Enable Markdown'} />}
              delay={500}
            >
              {(triggerRef) => (
                <IconButton
                  ref={triggerRef}
                  variant="SurfaceVariant"
                  onMouseDown={preventFocusLoss}
                  onTouchStart={preventFocusLoss}
                  onClick={() => setIsMarkdown(!isMarkdown)}
                  aria-pressed={isMarkdown}
                  size="300"
                  radii="300"
                >
                  <Icon size="200" src={Icons.Markdown} filled={isMarkdown} />
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
