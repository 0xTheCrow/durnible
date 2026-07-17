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
  const inputElement = document.createElement('div');
  inputElement.contentEditable = 'true';
  document.body.appendChild(inputElement);
  return inputElement;
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
  ])('Mod+%s calls toggleInlineMark(inputElement, %j) and returns true', (key, mark) => {
    const inputElement = setupContainer();
    const handled = handleEditorShortcut(inputElement, makeKeyEvent(key, { mod: true }));
    expect(mocked.toggleInlineMark).toHaveBeenCalledWith(inputElement, mark);
    expect(handled).toBe(true);
  });

  it.each(['b', 'i', 'u', 's'])(
    'Mod+%s is a no-op inside a <pre> block and returns false',
    (key) => {
      mocked.isBlockFormatActive.mockImplementation((_, tag) => tag === 'pre');
      const inputElement = setupContainer();
      const handled = handleEditorShortcut(inputElement, makeKeyEvent(key, { mod: true }));
      expect(mocked.toggleInlineMark).not.toHaveBeenCalled();
      expect(handled).toBe(false);
    }
  );
});

describe('handleEditorShortcut — inline code & spoiler', () => {
  it('Mod+[ calls toggleInlineCode(inputElement) and returns true', () => {
    const inputElement = setupContainer();
    const handled = handleEditorShortcut(inputElement, makeKeyEvent('[', { mod: true }));
    expect(mocked.toggleInlineCode).toHaveBeenCalledWith(inputElement);
    expect(handled).toBe(true);
  });

  it('Mod+H calls toggleSpoiler(inputElement) and returns true', () => {
    const inputElement = setupContainer();
    const handled = handleEditorShortcut(inputElement, makeKeyEvent('h', { mod: true }));
    expect(mocked.toggleSpoiler).toHaveBeenCalledWith(inputElement);
    expect(handled).toBe(true);
  });

  it('Mod+[ is a no-op inside a <pre> block', () => {
    mocked.isBlockFormatActive.mockImplementation((_, tag) => tag === 'pre');
    const inputElement = setupContainer();
    const handled = handleEditorShortcut(inputElement, makeKeyEvent('[', { mod: true }));
    expect(mocked.toggleInlineCode).not.toHaveBeenCalled();
    expect(handled).toBe(false);
  });

  it('Mod+H is a no-op inside a <pre> block', () => {
    mocked.isBlockFormatActive.mockImplementation((_, tag) => tag === 'pre');
    const inputElement = setupContainer();
    const handled = handleEditorShortcut(inputElement, makeKeyEvent('h', { mod: true }));
    expect(mocked.toggleSpoiler).not.toHaveBeenCalled();
    expect(handled).toBe(false);
  });
});

describe('handleEditorShortcut — lists', () => {
  it('Mod+7 dispatches toggleExecFormat("insertOrderedList")', () => {
    const inputElement = setupContainer();
    const handled = handleEditorShortcut(inputElement, makeKeyEvent('7', { mod: true }));
    expect(mocked.toggleExecFormat).toHaveBeenCalledWith('insertOrderedList');
    expect(handled).toBe(true);
  });

  it('Mod+8 dispatches toggleExecFormat("insertUnorderedList")', () => {
    const inputElement = setupContainer();
    const handled = handleEditorShortcut(inputElement, makeKeyEvent('8', { mod: true }));
    expect(mocked.toggleExecFormat).toHaveBeenCalledWith('insertUnorderedList');
    expect(handled).toBe(true);
  });
});

describe('handleEditorShortcut — block formats', () => {
  it("Mod+' calls toggleBlockFormat(inputElement, 'blockquote')", () => {
    const inputElement = setupContainer();
    const handled = handleEditorShortcut(inputElement, makeKeyEvent("'", { mod: true }));
    expect(mocked.toggleBlockFormat).toHaveBeenCalledWith(inputElement, 'blockquote');
    expect(handled).toBe(true);
  });

  it('Mod+; calls toggleCodeBlock(inputElement)', () => {
    const inputElement = setupContainer();
    const handled = handleEditorShortcut(inputElement, makeKeyEvent(';', { mod: true }));
    expect(mocked.toggleCodeBlock).toHaveBeenCalledWith(inputElement);
    expect(handled).toBe(true);
  });

  it.each([
    ['1', 'h1'],
    ['2', 'h2'],
    ['3', 'h3'],
  ])('Mod+%s calls toggleBlockFormat(inputElement, %j)', (key, tag) => {
    const inputElement = setupContainer();
    const handled = handleEditorShortcut(inputElement, makeKeyEvent(key, { mod: true }));
    expect(mocked.toggleBlockFormat).toHaveBeenCalledWith(inputElement, tag);
    expect(handled).toBe(true);
  });
});

describe('handleEditorShortcut — exit block', () => {
  it('Mod+E calls exitBlock when inside an exitable block', () => {
    mocked.isExitableBlock.mockReturnValue(true);
    const inputElement = setupContainer();
    const handled = handleEditorShortcut(inputElement, makeKeyEvent('e', { mod: true }));
    expect(mocked.exitBlock).toHaveBeenCalledWith(inputElement);
    expect(handled).toBe(true);
  });

  it('Escape calls exitBlock when inside an exitable block', () => {
    mocked.isExitableBlock.mockReturnValue(true);
    const inputElement = setupContainer();
    const handled = handleEditorShortcut(inputElement, makeKeyEvent('Escape'));
    expect(mocked.exitBlock).toHaveBeenCalledWith(inputElement);
    expect(handled).toBe(true);
  });

  it('Mod+E is a no-op when not inside an exitable block', () => {
    mocked.isExitableBlock.mockReturnValue(false);
    const inputElement = setupContainer();
    const handled = handleEditorShortcut(inputElement, makeKeyEvent('e', { mod: true }));
    expect(mocked.exitBlock).not.toHaveBeenCalled();
    expect(handled).toBe(false);
  });

  it('Escape is a no-op when not inside an exitable block', () => {
    mocked.isExitableBlock.mockReturnValue(false);
    const inputElement = setupContainer();
    const handled = handleEditorShortcut(inputElement, makeKeyEvent('Escape'));
    expect(mocked.exitBlock).not.toHaveBeenCalled();
    expect(handled).toBe(false);
  });
});

describe('handleEditorShortcut — backspace-to-exit', () => {
  it('exits the block when caret is at offset 0 of an empty heading', () => {
    mocked.isExitableBlock.mockReturnValue(true);
    const inputElement = setupContainer();
    const heading = document.createElement('h1');
    inputElement.appendChild(heading);
    placeCaretAt(heading, 0);

    const handled = handleEditorShortcut(inputElement, makeKeyEvent('Backspace'));
    expect(mocked.exitBlock).toHaveBeenCalledWith(inputElement);
    expect(handled).toBe(true);
  });

  it('does nothing when the caret is mid-text inside an exitable block', () => {
    mocked.isExitableBlock.mockReturnValue(true);
    const inputElement = setupContainer();
    const heading = document.createElement('h1');
    const text = document.createTextNode('hello');
    heading.appendChild(text);
    inputElement.appendChild(heading);
    placeCaretAt(text, 2);

    const handled = handleEditorShortcut(inputElement, makeKeyEvent('Backspace'));
    expect(mocked.exitBlock).not.toHaveBeenCalled();
    expect(handled).toBe(false);
  });

  it('does nothing when caret is at offset 0 but inside a non-exitable block', () => {
    mocked.isExitableBlock.mockReturnValue(false);
    const inputElement = setupContainer();
    const paragraph = document.createElement('p');
    inputElement.appendChild(paragraph);
    placeCaretAt(paragraph, 0);

    const handled = handleEditorShortcut(inputElement, makeKeyEvent('Backspace'));
    expect(mocked.exitBlock).not.toHaveBeenCalled();
    expect(handled).toBe(false);
  });

  it('does nothing when a non-empty prior sibling exists in the same block', () => {
    mocked.isExitableBlock.mockReturnValue(true);
    const inputElement = setupContainer();
    const heading = document.createElement('h1');
    const leading = document.createTextNode('abc');
    const trailing = document.createTextNode('');
    heading.appendChild(leading);
    heading.appendChild(trailing);
    inputElement.appendChild(heading);
    placeCaretAt(trailing, 0);

    const handled = handleEditorShortcut(inputElement, makeKeyEvent('Backspace'));
    expect(mocked.exitBlock).not.toHaveBeenCalled();
    expect(handled).toBe(false);
  });
});
