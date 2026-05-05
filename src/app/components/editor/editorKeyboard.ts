import { isKeyHotkey } from 'is-hotkey';
import type { KeyboardEvent } from 'react';
import {
  exitBlock,
  isBlockFormatActive,
  isExitableBlock,
  toggleBlockFormat,
  toggleCodeBlock,
  toggleExecFormat,
  toggleInlineCode,
  toggleSpoiler,
} from './editorFormatting';
import { mobileOrTablet } from '../../utils/user-agent';
import type { KeybindMap } from '../../state/keybinds';
import { defaultKeybinds, KeybindAction } from '../../state/keybinds';

export const isSubmitEnterHotkey = (
  evt: KeyboardEvent<Element>,
  enterForNewline: boolean,
  keybinds: KeybindMap = defaultKeybinds
): boolean =>
  isKeyHotkey(keybinds[KeybindAction.ComposeSend], evt) ||
  (!enterForNewline && !mobileOrTablet() && isKeyHotkey('enter', evt));

const INLINE_MARK_ACTIONS: ReadonlyArray<{ id: KeybindAction; command: string }> = [
  { id: KeybindAction.FormatBold, command: 'bold' },
  { id: KeybindAction.FormatItalic, command: 'italic' },
  { id: KeybindAction.FormatUnderline, command: 'underline' },
  { id: KeybindAction.FormatStrikethrough, command: 'strikeThrough' },
];

const LIST_ACTIONS: ReadonlyArray<{ id: KeybindAction; command: string }> = [
  { id: KeybindAction.FormatOrderedList, command: 'insertOrderedList' },
  { id: KeybindAction.FormatUnorderedList, command: 'insertUnorderedList' },
];

const HEADING_ACTIONS: ReadonlyArray<{ id: KeybindAction; tag: string }> = [
  { id: KeybindAction.FormatHeading1, tag: 'h1' },
  { id: KeybindAction.FormatHeading2, tag: 'h2' },
  { id: KeybindAction.FormatHeading3, tag: 'h3' },
];

const isCaretAtBlockStart = (el: HTMLElement): boolean => {
  const sel = window.getSelection();
  if (!sel || sel.rangeCount === 0) return false;
  const range = sel.getRangeAt(0);
  if (!range.collapsed) return false;
  if (!el.contains(range.startContainer)) return false;
  if (range.startOffset !== 0) return false;

  let node: Node | null = range.startContainer;
  while (node && node !== el) {
    let prev: Node | null = node.previousSibling;
    while (prev) {
      if (prev.nodeType === Node.TEXT_NODE) {
        if ((prev as Text).data.length > 0) return false;
      } else {
        return false;
      }
      prev = prev.previousSibling;
    }
    node = node.parentNode;
  }
  return true;
};

export const handleEditorShortcut = (
  el: HTMLDivElement,
  evt: KeyboardEvent<Element>,
  keybinds: KeybindMap = defaultKeybinds
): boolean => {
  if (isKeyHotkey('backspace', evt)) {
    if (isExitableBlock(el) && isCaretAtBlockStart(el)) {
      exitBlock(el);
      return true;
    }
    return false;
  }

  if (isKeyHotkey(keybinds[KeybindAction.FormatExitBlock], evt) || isKeyHotkey('escape', evt)) {
    if (isExitableBlock(el)) {
      exitBlock(el);
      return true;
    }
    return false;
  }

  const insideCodeBlock = isBlockFormatActive(el, 'pre');

  for (const { id, command } of INLINE_MARK_ACTIONS) {
    if (isKeyHotkey(keybinds[id], evt)) {
      if (insideCodeBlock) return false;
      toggleExecFormat(command);
      return true;
    }
  }

  if (isKeyHotkey(keybinds[KeybindAction.FormatInlineCode], evt)) {
    if (insideCodeBlock) return false;
    toggleInlineCode(el);
    return true;
  }

  if (isKeyHotkey(keybinds[KeybindAction.FormatSpoiler], evt)) {
    if (insideCodeBlock) return false;
    toggleSpoiler(el);
    return true;
  }

  for (const { id, command } of LIST_ACTIONS) {
    if (isKeyHotkey(keybinds[id], evt)) {
      toggleExecFormat(command);
      return true;
    }
  }

  if (isKeyHotkey(keybinds[KeybindAction.FormatBlockquote], evt)) {
    toggleBlockFormat(el, 'blockquote');
    return true;
  }

  if (isKeyHotkey(keybinds[KeybindAction.FormatCodeBlock], evt)) {
    toggleCodeBlock(el);
    return true;
  }

  for (const { id, tag } of HEADING_ACTIONS) {
    if (isKeyHotkey(keybinds[id], evt)) {
      toggleBlockFormat(el, tag);
      return true;
    }
  }

  return false;
};
