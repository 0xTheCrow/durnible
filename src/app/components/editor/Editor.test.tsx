import React, { forwardRef, useImperativeHandle } from 'react';
import { render, act, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { Editor as SlateEditor } from 'slate';
import { Transforms } from 'slate';
import { getDefaultStore } from 'jotai';
import type { MatrixClient } from 'matrix-js-sdk';
import type * as MatrixUtils from '../../utils/matrix';
import { CustomEditor, useEditor } from './Editor';
import { createEmoticonElement } from './utils';
import { BlockType } from './types';
import { settingsAtom } from '../../state/settings';
import { MatrixTestWrapper } from '../../../test/wrapper';
import { createAltEmoticonNode } from './altInput';
import type { EmoticonElement, ParagraphElement } from './slate';

vi.mock('../../utils/user-agent', () => ({
  mobileOrTablet: () => false,
}));

vi.mock('../../utils/matrix', async () => {
  const actual = (await vi.importActual('../../utils/matrix')) as typeof MatrixUtils;
  return {
    ...actual,
    mxcUrlToHttp: (_mx: unknown, key: string) =>
      key.startsWith('mxc://') ? `https://example.com/${key.slice(6)}` : null,
  };
});

if (
  typeof HTMLElement !== 'undefined' &&
  !Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'innerText')
) {
  Object.defineProperty(HTMLElement.prototype, 'innerText', {
    get() {
      return this.textContent ?? '';
    },
    set(value: string) {
      this.textContent = value;
    },
    configurable: true,
  });
}

function setAlternateInput(enabled: boolean) {
  const store = getDefaultStore();
  store.set(settingsAtom, { ...store.get(settingsAtom), alternateInput: enabled });
}

type Handle = { editor: SlateEditor };

const TestHarness = forwardRef<Handle>((_props, ref) => {
  const editor = useEditor();
  useImperativeHandle(ref, () => ({ editor }), [editor]);
  return <CustomEditor editor={editor} />;
});
TestHarness.displayName = 'TestHarness';

function renderHarness() {
  const ref = React.createRef<Handle>();
  const utils = render(
    <MatrixTestWrapper>
      <TestHarness ref={ref} />
    </MatrixTestWrapper>
  );
  return { ...utils, getEditor: () => ref.current!.editor };
}

function extractSlateText(editor: SlateEditor): string {
  return editor.children
    .map((node) => {
      if ('children' in node) {
        return (node.children as Array<{ text?: string; type?: BlockType }>)
          .map((child) => {
            if (typeof child.text === 'string') return child.text;
            if (child.type === BlockType.Emoticon) {
              return (child as unknown as { key: string }).key;
            }
            return '';
          })
          .join('');
      }
      return '';
    })
    .join('');
}

const originalExecCommand = document.execCommand;

beforeEach(() => {
  document.execCommand = ((command: string, _showUI?: boolean, value?: string) => {
    if (command !== 'insertText') return false;
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0) return false;
    const range = sel.getRangeAt(0);
    range.deleteContents();
    const node = document.createTextNode(value ?? '');
    range.insertNode(node);
    const newRange = document.createRange();
    newRange.setStart(node, node.textContent?.length ?? 0);
    newRange.collapse(true);
    sel.removeAllRanges();
    sel.addRange(newRange);
    return true;
  }) as typeof document.execCommand;
});

afterEach(() => {
  document.execCommand = originalExecCommand;
  setAlternateInput(false);
});

function positionCursorInContentEditable(el: HTMLElement, offset: number) {
  const textNode = el.firstChild as Text | null;
  if (!textNode) throw new Error('contentEditable has no text node');
  const range = document.createRange();
  range.setStart(textNode, offset);
  range.setEnd(textNode, offset);
  const sel = window.getSelection();
  sel?.removeAllRanges();
  sel?.addRange(range);
}

describe('Alternate input emoji insertion', () => {
  beforeEach(() => {
    setAlternateInput(true);
  });

  it('inserts text at the saved cursor position after focus loss', () => {
    const { getByTestId, getEditor } = renderHarness();
    const el = getByTestId('editor-alternate-input') as HTMLDivElement;

    el.focus();
    el.textContent = 'hello world';
    fireEvent.input(el);

    positionCursorInContentEditable(el, 5);
    document.dispatchEvent(new Event('selectionchange'));

    // simulate selection being lost and focus moving away (as happens when
    // the emoji picker's auto-focused search input steals focus)
    window.getSelection()?.removeAllRanges();
    document.dispatchEvent(new Event('selectionchange'));
    fireEvent.blur(el);

    act(() => {
      getEditor().insertAlternateText!('😀');
    });

    expect(el.textContent).toBe('hello😀 world');
  });

  it('advances the cursor across sequential insertions without re-focusing', () => {
    const { getByTestId, getEditor } = renderHarness();
    const el = getByTestId('editor-alternate-input') as HTMLDivElement;

    el.focus();
    el.textContent = 'hello world';
    fireEvent.input(el);

    positionCursorInContentEditable(el, 5);
    document.dispatchEvent(new Event('selectionchange'));

    window.getSelection()?.removeAllRanges();
    document.dispatchEvent(new Event('selectionchange'));
    fireEvent.blur(el);

    act(() => {
      getEditor().insertAlternateText!('A');
    });
    act(() => {
      getEditor().insertAlternateText!('B');
    });

    expect(el.textContent).toBe('helloAB world');
  });

  it('does not throw when insertAlternateText is called with no prior selection', () => {
    const { getByTestId, getEditor } = renderHarness();
    const el = getByTestId('editor-alternate-input') as HTMLDivElement;

    expect(() => {
      act(() => {
        getEditor().insertAlternateText!('X');
      });
    }).not.toThrow();
    expect(el.textContent).toContain('X');
  });
});

describe('Alternate input node insertion', () => {
  beforeEach(() => {
    setAlternateInput(true);
  });

  const mockMx = {} as MatrixClient;

  const firstParagraph = (editor: SlateEditor): ParagraphElement => {
    const first = editor.children[0] as ParagraphElement;
    expect(first.type).toBe(BlockType.Paragraph);
    return first;
  };

  it('inserts a DOM node at the saved caret and serializes it as an inline void', () => {
    const { getByTestId, getEditor } = renderHarness();
    const el = getByTestId('editor-alternate-input') as HTMLDivElement;

    el.focus();
    el.textContent = 'hello world';
    fireEvent.input(el);

    positionCursorInContentEditable(el, 5);
    document.dispatchEvent(new Event('selectionchange'));

    window.getSelection()?.removeAllRanges();
    document.dispatchEvent(new Event('selectionchange'));
    fireEvent.blur(el);

    const node = createAltEmoticonNode({
      mx: mockMx,
      useAuthentication: false,
      key: 'mxc://example/wave',
      shortcode: 'wave',
    });

    act(() => {
      getEditor().insertAlternateNode!(node);
    });

    const paragraph = firstParagraph(getEditor());
    const emoticonIndex = paragraph.children.findIndex(
      (child) => 'type' in child && child.type === BlockType.Emoticon
    );
    expect(emoticonIndex).toBeGreaterThan(0);
    const emoticon = paragraph.children[emoticonIndex] as EmoticonElement;
    expect(emoticon.key).toBe('mxc://example/wave');
    expect(emoticon.shortcode).toBe('wave');

    const beforeText = paragraph.children
      .slice(0, emoticonIndex)
      .map((child) => ('text' in child ? child.text : ''))
      .join('');
    const afterText = paragraph.children
      .slice(emoticonIndex + 1)
      .map((child) => ('text' in child ? child.text : ''))
      .join('');
    expect(beforeText).toBe('hello');
    expect(afterText).toBe(' world');
  });

  it('preserves an existing inline void when inserting text via insertAlternateText', () => {
    const { getByTestId, getEditor } = renderHarness();
    const el = getByTestId('editor-alternate-input') as HTMLDivElement;

    el.focus();

    const node = createAltEmoticonNode({
      mx: mockMx,
      useAuthentication: false,
      key: 'mxc://example/wave',
      shortcode: 'wave',
    });

    act(() => {
      getEditor().insertAlternateNode!(node);
    });
    act(() => {
      getEditor().insertAlternateText!(' there');
    });

    expect(el.querySelectorAll('[data-alt-type="emoticon"]')).toHaveLength(1);

    const paragraph = firstParagraph(getEditor());
    const hasEmoticon = paragraph.children.some(
      (child) => 'type' in child && child.type === BlockType.Emoticon
    );
    expect(hasEmoticon).toBe(true);

    const flatText = paragraph.children
      .map((child) => ('text' in child ? child.text : ''))
      .join('');
    expect(flatText).toContain(' there');
  });
});

describe('Slate editor emoji insertion', () => {
  beforeEach(() => {
    setAlternateInput(false);
  });

  it('inserts an emoticon at the Slate selection after the editable has blurred', () => {
    const { getByTestId, getEditor } = renderHarness();
    // ensure the Slate editable is present
    getByTestId('editor-slate');

    const editor = getEditor();

    act(() => {
      Transforms.insertText(editor, 'hello world', {
        at: { path: [0, 0], offset: 0 },
      });
    });

    act(() => {
      Transforms.select(editor, {
        anchor: { path: [0, 0], offset: 5 },
        focus: { path: [0, 0], offset: 5 },
      });
    });

    // simulate focus moving to the emoji picker's search input — in a real
    // browser the window selection moves out of the editable, but Slate's
    // editor.selection is independent and should still drive insertNode.
    window.getSelection()?.removeAllRanges();

    act(() => {
      editor.insertNode(createEmoticonElement('😀', 'grinning'));
    });

    expect(extractSlateText(editor)).toBe('hello😀 world');
  });
});
