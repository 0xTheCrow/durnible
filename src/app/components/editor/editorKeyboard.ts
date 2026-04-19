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

const INLINE_MARK_HOTKEYS: Record<string, string> = {
  'mod+b': 'bold',
  'mod+i': 'italic',
  'mod+u': 'underline',
  'mod+s': 'strikeThrough',
};

const LIST_HOTKEYS: Record<string, string> = {
  'mod+7': 'insertOrderedList',
  'mod+8': 'insertUnorderedList',
};

const HEADING_HOTKEYS: Record<string, string> = {
  'mod+1': 'h1',
  'mod+2': 'h2',
  'mod+3': 'h3',
};

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

export const handleEditorShortcut = (el: HTMLDivElement, evt: KeyboardEvent<Element>): boolean => {
  if (isKeyHotkey('backspace', evt)) {
    if (isExitableBlock(el) && isCaretAtBlockStart(el)) {
      exitBlock(el);
      return true;
    }
    return false;
  }

  if (isKeyHotkey('mod+e', evt) || isKeyHotkey('escape', evt)) {
    if (isExitableBlock(el)) {
      exitBlock(el);
      return true;
    }
    return false;
  }

  const insideCodeBlock = isBlockFormatActive(el, 'pre');

  for (const [hotkey, command] of Object.entries(INLINE_MARK_HOTKEYS)) {
    if (isKeyHotkey(hotkey, evt)) {
      if (insideCodeBlock) return false;
      toggleExecFormat(command);
      return true;
    }
  }

  if (isKeyHotkey('mod+[', evt)) {
    if (insideCodeBlock) return false;
    toggleInlineCode(el);
    return true;
  }

  if (isKeyHotkey('mod+h', evt)) {
    if (insideCodeBlock) return false;
    toggleSpoiler(el);
    return true;
  }

  for (const [hotkey, command] of Object.entries(LIST_HOTKEYS)) {
    if (isKeyHotkey(hotkey, evt)) {
      toggleExecFormat(command);
      return true;
    }
  }

  if (isKeyHotkey("mod+'", evt)) {
    toggleBlockFormat(el, 'blockquote');
    return true;
  }

  if (isKeyHotkey('mod+;', evt)) {
    toggleCodeBlock(el);
    return true;
  }

  for (const [hotkey, tag] of Object.entries(HEADING_HOTKEYS)) {
    if (isKeyHotkey(hotkey, evt)) {
      toggleBlockFormat(el, tag);
      return true;
    }
  }

  return false;
};
