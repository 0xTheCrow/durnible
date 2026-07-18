import { describe, it, expect, beforeEach } from 'vitest';
import { isInlineMarkActive, toggleInlineMark } from './editorFormatting';

const ZWSP = '\u200B';

const setupInput = (html: string): HTMLDivElement => {
  const input = document.createElement('div');
  input.contentEditable = 'true';
  input.innerHTML = html;
  document.body.appendChild(input);
  return input;
};

const firstText = (node: Node): Text => {
  if (node.nodeType === Node.TEXT_NODE) return node as Text;
  for (let i = 0; i < node.childNodes.length; i += 1) {
    const found = firstText(node.childNodes[i]);
    if (found) return found;
  }
  throw new Error('no text node found');
};

const setCaret = (node: Node, offset: number) => {
  const range = document.createRange();
  range.setStart(node, offset);
  range.collapse(true);
  const sel = window.getSelection();
  sel?.removeAllRanges();
  sel?.addRange(range);
};

const setRange = (startNode: Node, startOffset: number, endNode: Node, endOffset: number) => {
  const range = document.createRange();
  range.setStart(startNode, startOffset);
  range.setEnd(endNode, endOffset);
  const sel = window.getSelection();
  sel?.removeAllRanges();
  sel?.addRange(range);
};

const caretAncestorTag = (tag: string): boolean => {
  const sel = window.getSelection();
  if (!sel || sel.rangeCount === 0) return false;
  let node: Node | null = sel.getRangeAt(0).startContainer;
  while (node) {
    if (node.nodeType === Node.ELEMENT_NODE && (node as HTMLElement).tagName === tag) return true;
    node = node.parentNode;
  }
  return false;
};

beforeEach(() => {
  document.body.innerHTML = '';
});

describe('toggleInlineMark — turning on', () => {
  it('collapsed caret not in the mark inserts an anchored mark element with the caret inside', () => {
    const input = setupInput('ab');
    setCaret(input.firstChild!, 1);

    toggleInlineMark(input, 'bold');

    expect(input.querySelector('strong')?.textContent).toBe(ZWSP);
    expect(caretAncestorTag('STRONG')).toBe(true);
    expect(isInlineMarkActive(input, 'bold')).toBe(true);
  });

  it('a selected range not in the mark wraps only the selection', () => {
    const input = setupInput('hello');
    const text = firstText(input);
    setRange(text, 1, text, 4);

    toggleInlineMark(input, 'bold');

    expect(input.querySelector('strong')?.textContent).toBe('ell');
    expect(input.textContent).toBe('hello');
  });
});

describe('toggleInlineMark — turning off', () => {
  it('a selected range inside the mark unwraps it', () => {
    const input = setupInput('<strong>hello</strong>');
    const text = firstText(input);
    setRange(text, 0, text, 5);

    toggleInlineMark(input, 'bold');

    expect(input.querySelector('strong')).toBeNull();
    expect(input.textContent).toBe('hello');
  });

  it('collapsed at the end of a run keeps the text formatted and moves the caret outside', () => {
    const input = setupInput('<strong>hello</strong>');
    const text = firstText(input);
    setCaret(text, 5);

    toggleInlineMark(input, 'bold');

    expect(input.querySelector('strong')?.textContent).toBe('hello');
    expect(caretAncestorTag('STRONG')).toBe(false);
    expect(isInlineMarkActive(input, 'bold')).toBe(false);
  });

  it('after exiting a run a second mark is applied outside the first, not nested in it', () => {
    const input = setupInput('<strong>hello</strong>');
    setCaret(firstText(input), 5);
    toggleInlineMark(input, 'bold');

    toggleInlineMark(input, 'italic');

    expect(isInlineMarkActive(input, 'italic')).toBe(true);
    expect(isInlineMarkActive(input, 'bold')).toBe(false);
    expect(input.querySelector('strong em')).toBeNull();
    expect(input.querySelector('em')).not.toBeNull();
  });

  it('exiting a nested mark keeps the surrounding mark active', () => {
    const input = setupInput('<em><strong>hi</strong></em>');
    const text = firstText(input);
    setCaret(text, 2);

    toggleInlineMark(input, 'bold');

    expect(isInlineMarkActive(input, 'italic')).toBe(true);
    expect(isInlineMarkActive(input, 'bold')).toBe(false);
    expect(input.querySelector('em strong')?.textContent).toBe('hi');
  });

  it('collapsed in the middle of a run splits the mark in two', () => {
    const input = setupInput('<strong>hello</strong>');
    const text = firstText(input);
    setCaret(text, 2);

    toggleInlineMark(input, 'bold');

    const strongs = input.querySelectorAll('strong');
    expect(strongs).toHaveLength(2);
    expect(strongs[0].textContent).toBe('he');
    expect(strongs[1].textContent).toBe('llo');
    expect(isInlineMarkActive(input, 'bold')).toBe(false);
  });
});

describe('isInlineMarkActive', () => {
  it('detects legacy tag aliases', () => {
    const input = setupInput('<b>x</b>');
    setCaret(firstText(input), 1);

    expect(isInlineMarkActive(input, 'bold')).toBe(true);
  });
});
