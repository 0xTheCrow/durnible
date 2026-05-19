import { describe, it, expect, vi, beforeEach } from 'vitest';
import type React from 'react';
import { handleEditorShortcut } from './editorKeyboard';
import * as formatting from './editorFormatting';

vi.mock('./editorFormatting');

const mocked = vi.mocked(formatting);

type Mods = { mod?: boolean; shift?: boolean; alt?: boolean };

// src/test/setup.ts pins navigator.platform so is-hotkey's `mod` alias
// resolves to ctrlKey in all test environments.
const makeKeyEvent = (key: string, mods: Mods = {}): React.KeyboardEvent =>
  ({
    key,
    ctrlKey: mods.mod ?? false,
    metaKey: false,
    shiftKey: mods.shift ?? false,
    altKey: mods.alt ?? false,
    preventDefault: vi.fn(),
    defaultPrevented: false,
  } as unknown as React.KeyboardEvent);

const setupContainer = (): HTMLDivElement => {
  const el = document.createElement('div');
  el.contentEditable = 'true';
  document.body.appendChild(el);
  return el;
};

const placeCaretAt = (node: Node, offset: number) => {
  const range = document.createRange();
  range.setStart(node, offset);
  range.collapse(true);
  const sel = window.getSelection();
  sel?.removeAllRanges();
  sel?.addRange(range);
};

beforeEach(() => {
  vi.resetAllMocks();
  mocked.isBlockFormatActive.mockReturnValue(false);
  mocked.isExitableBlock.mockReturnValue(false);
  document.body.innerHTML = '';
});

describe('handleEditorShortcut — inline marks', () => {
  it.each([
    ['b', 'bold'],
    ['i', 'italic'],
    ['u', 'underline'],
    ['s', 'strikeThrough'],
  ])('Mod+%s dispatches toggleExecFormat(%j) and returns true', (key, command) => {
    const el = setupContainer();
    const handled = handleEditorShortcut(el, makeKeyEvent(key, { mod: true }));
    expect(mocked.toggleExecFormat).toHaveBeenCalledWith(command);
    expect(handled).toBe(true);
  });

  it.each(['b', 'i', 'u', 's'])(
    'Mod+%s is a no-op inside a <pre> block and returns false',
    (key) => {
      mocked.isBlockFormatActive.mockImplementation((_, tag) => tag === 'pre');
      const el = setupContainer();
      const handled = handleEditorShortcut(el, makeKeyEvent(key, { mod: true }));
      expect(mocked.toggleExecFormat).not.toHaveBeenCalled();
      expect(handled).toBe(false);
    }
  );
});

describe('handleEditorShortcut — inline code & spoiler', () => {
  it('Mod+[ calls toggleInlineCode(el) and returns true', () => {
    const el = setupContainer();
    const handled = handleEditorShortcut(el, makeKeyEvent('[', { mod: true }));
    expect(mocked.toggleInlineCode).toHaveBeenCalledWith(el);
    expect(handled).toBe(true);
  });

  it('Mod+H calls toggleSpoiler(el) and returns true', () => {
    const el = setupContainer();
    const handled = handleEditorShortcut(el, makeKeyEvent('h', { mod: true }));
    expect(mocked.toggleSpoiler).toHaveBeenCalledWith(el);
    expect(handled).toBe(true);
  });

  it('Mod+[ is a no-op inside a <pre> block', () => {
    mocked.isBlockFormatActive.mockImplementation((_, tag) => tag === 'pre');
    const el = setupContainer();
    const handled = handleEditorShortcut(el, makeKeyEvent('[', { mod: true }));
    expect(mocked.toggleInlineCode).not.toHaveBeenCalled();
    expect(handled).toBe(false);
  });

  it('Mod+H is a no-op inside a <pre> block', () => {
    mocked.isBlockFormatActive.mockImplementation((_, tag) => tag === 'pre');
    const el = setupContainer();
    const handled = handleEditorShortcut(el, makeKeyEvent('h', { mod: true }));
    expect(mocked.toggleSpoiler).not.toHaveBeenCalled();
    expect(handled).toBe(false);
  });
});

describe('handleEditorShortcut — lists', () => {
  it('Mod+7 dispatches toggleExecFormat("insertOrderedList")', () => {
    const el = setupContainer();
    const handled = handleEditorShortcut(el, makeKeyEvent('7', { mod: true }));
    expect(mocked.toggleExecFormat).toHaveBeenCalledWith('insertOrderedList');
    expect(handled).toBe(true);
  });

  it('Mod+8 dispatches toggleExecFormat("insertUnorderedList")', () => {
    const el = setupContainer();
    const handled = handleEditorShortcut(el, makeKeyEvent('8', { mod: true }));
    expect(mocked.toggleExecFormat).toHaveBeenCalledWith('insertUnorderedList');
    expect(handled).toBe(true);
  });
});

describe('handleEditorShortcut — block formats', () => {
  it("Mod+' calls toggleBlockFormat(el, 'blockquote')", () => {
    const el = setupContainer();
    const handled = handleEditorShortcut(el, makeKeyEvent("'", { mod: true }));
    expect(mocked.toggleBlockFormat).toHaveBeenCalledWith(el, 'blockquote');
    expect(handled).toBe(true);
  });

  it('Mod+; calls toggleCodeBlock(el)', () => {
    const el = setupContainer();
    const handled = handleEditorShortcut(el, makeKeyEvent(';', { mod: true }));
    expect(mocked.toggleCodeBlock).toHaveBeenCalledWith(el);
    expect(handled).toBe(true);
  });

  it.each([
    ['1', 'h1'],
    ['2', 'h2'],
    ['3', 'h3'],
  ])('Mod+%s calls toggleBlockFormat(el, %j)', (key, tag) => {
    const el = setupContainer();
    const handled = handleEditorShortcut(el, makeKeyEvent(key, { mod: true }));
    expect(mocked.toggleBlockFormat).toHaveBeenCalledWith(el, tag);
    expect(handled).toBe(true);
  });
});

describe('handleEditorShortcut — exit block', () => {
  it('Mod+E calls exitBlock when inside an exitable block', () => {
    mocked.isExitableBlock.mockReturnValue(true);
    const el = setupContainer();
    const handled = handleEditorShortcut(el, makeKeyEvent('e', { mod: true }));
    expect(mocked.exitBlock).toHaveBeenCalledWith(el);
    expect(handled).toBe(true);
  });

  it('Escape calls exitBlock when inside an exitable block', () => {
    mocked.isExitableBlock.mockReturnValue(true);
    const el = setupContainer();
    const handled = handleEditorShortcut(el, makeKeyEvent('Escape'));
    expect(mocked.exitBlock).toHaveBeenCalledWith(el);
    expect(handled).toBe(true);
  });

  it('Mod+E is a no-op when not inside an exitable block', () => {
    mocked.isExitableBlock.mockReturnValue(false);
    const el = setupContainer();
    const handled = handleEditorShortcut(el, makeKeyEvent('e', { mod: true }));
    expect(mocked.exitBlock).not.toHaveBeenCalled();
    expect(handled).toBe(false);
  });

  it('Escape is a no-op when not inside an exitable block', () => {
    mocked.isExitableBlock.mockReturnValue(false);
    const el = setupContainer();
    const handled = handleEditorShortcut(el, makeKeyEvent('Escape'));
    expect(mocked.exitBlock).not.toHaveBeenCalled();
    expect(handled).toBe(false);
  });
});

describe('handleEditorShortcut — backspace-to-exit', () => {
  it('exits the block when caret is at offset 0 of an empty heading', () => {
    mocked.isExitableBlock.mockReturnValue(true);
    const el = setupContainer();
    const heading = document.createElement('h1');
    el.appendChild(heading);
    placeCaretAt(heading, 0);

    const handled = handleEditorShortcut(el, makeKeyEvent('Backspace'));
    expect(mocked.exitBlock).toHaveBeenCalledWith(el);
    expect(handled).toBe(true);
  });

  it('does nothing when the caret is mid-text inside an exitable block', () => {
    mocked.isExitableBlock.mockReturnValue(true);
    const el = setupContainer();
    const heading = document.createElement('h1');
    const text = document.createTextNode('hello');
    heading.appendChild(text);
    el.appendChild(heading);
    placeCaretAt(text, 2);

    const handled = handleEditorShortcut(el, makeKeyEvent('Backspace'));
    expect(mocked.exitBlock).not.toHaveBeenCalled();
    expect(handled).toBe(false);
  });

  it('does nothing when caret is at offset 0 but inside a non-exitable block', () => {
    mocked.isExitableBlock.mockReturnValue(false);
    const el = setupContainer();
    const paragraph = document.createElement('p');
    el.appendChild(paragraph);
    placeCaretAt(paragraph, 0);

    const handled = handleEditorShortcut(el, makeKeyEvent('Backspace'));
    expect(mocked.exitBlock).not.toHaveBeenCalled();
    expect(handled).toBe(false);
  });

  it('does nothing when a non-empty prior sibling exists in the same block', () => {
    mocked.isExitableBlock.mockReturnValue(true);
    const el = setupContainer();
    const heading = document.createElement('h1');
    const leading = document.createTextNode('abc');
    const trailing = document.createTextNode('');
    heading.appendChild(leading);
    heading.appendChild(trailing);
    el.appendChild(heading);
    placeCaretAt(trailing, 0);

    const handled = handleEditorShortcut(el, makeKeyEvent('Backspace'));
    expect(mocked.exitBlock).not.toHaveBeenCalled();
    expect(handled).toBe(false);
  });
});
