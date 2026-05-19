import React from 'react';
import { render, screen, act, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { CustomEditor, type EditorController } from './Editor';
import { MatrixTestWrapper } from '../../../test/wrapper';
import * as formatting from './editorFormatting';

vi.mock('./editorFormatting');
const mockedFormatting = vi.mocked(formatting);

const { getImageUrlBlobMock } = vi.hoisted(() => ({
  getImageUrlBlobMock: vi.fn(),
}));

vi.mock('../../utils/dom', () => ({
  getImageUrlBlob: getImageUrlBlobMock,
}));

const renderEditor = (
  props: {
    onChange?: () => void;
    onFiles?: (files: File[]) => void;
  } = {}
) => {
  const ref = React.createRef<EditorController | null>();
  const result = render(
    <MatrixTestWrapper>
      <CustomEditor editorInputRef={ref} {...props} />
    </MatrixTestWrapper>
  );
  const editable = screen.getByTestId('editor') as HTMLDivElement;
  return { ref, editable, ...result };
};

const placeCaretAt = (node: Node, offset: number) => {
  const range = document.createRange();
  range.setStart(node, offset);
  range.collapse(true);
  const sel = window.getSelection();
  sel?.removeAllRanges();
  sel?.addRange(range);
  // Component listens on document for selectionchange; dispatch to populate
  // savedRangeRef so subsequent insertText/Node use the tracked position.
  document.dispatchEvent(new Event('selectionchange'));
};

beforeEach(() => {
  vi.resetAllMocks();
  mockedFormatting.isBlockFormatActive.mockReturnValue(false);
  mockedFormatting.isExitableBlock.mockReturnValue(false);
  getImageUrlBlobMock.mockReset();
});

describe('EditorController', () => {
  it('focus() focuses the contenteditable element', () => {
    const { ref, editable } = renderEditor();
    act(() => ref.current?.focus());
    expect(document.activeElement).toBe(editable);
  });

  it('.el exposes the current contenteditable element', () => {
    const { ref, editable } = renderEditor();
    expect(ref.current?.el).toBe(editable);
  });

  it('insertText appends text when caret has not been placed', () => {
    const { ref, editable } = renderEditor();
    act(() => ref.current?.insertText('hello'));
    // insertNodeAtRange may prepend a zero-width caret anchor when no
    // sibling exists; strip it before comparing.
    expect(editable.textContent?.replace(/\u200B/g, '')).toBe('hello');
  });

  it('insertText calls onChange and flips data-empty off', () => {
    const onChange = vi.fn();
    const { ref, editable } = renderEditor({ onChange });
    expect(editable.hasAttribute('data-empty')).toBe(true);
    act(() => ref.current?.insertText('hi'));
    expect(onChange).toHaveBeenCalled();
    expect(editable.hasAttribute('data-empty')).toBe(false);
  });

  it('insertText preserves the saved caret position across focus loss', () => {
    const { ref, editable } = renderEditor();
    const text = document.createTextNode('hello world');
    editable.appendChild(text);
    act(() => ref.current?.focus());
    placeCaretAt(text, 5);
    // Simulate losing focus (e.g. user clicked a toolbar button)
    editable.blur();
    act(() => ref.current?.insertText('ITEM'));
    expect(editable.textContent).toBe('helloITEM world');
  });

  it('insertNode inserts a given DOM node at the saved caret', () => {
    const { ref, editable } = renderEditor();
    const voidNode = document.createElement('span');
    voidNode.setAttribute('data-node-type', 'emoticon');
    voidNode.textContent = '[wave]';
    act(() => ref.current?.insertNode(voidNode));
    expect(editable.contains(voidNode)).toBe(true);
  });

  it('setContent replaces the contents via htmlToEditorDom', () => {
    const { ref, editable } = renderEditor();
    act(() => ref.current?.setContent('<p>hi there</p>'));
    expect(editable.textContent).toContain('hi there');
  });

  it('setContent flips data-empty off when content is non-empty', () => {
    const { ref, editable } = renderEditor();
    expect(editable.hasAttribute('data-empty')).toBe(true);
    act(() => ref.current?.setContent('<p>populated</p>'));
    expect(editable.hasAttribute('data-empty')).toBe(false);
  });
});

describe('CustomEditor — keyboard integration', () => {
  it('Mod+B dispatches the editorFormatting.toggleExecFormat helper', () => {
    const { editable } = renderEditor();
    fireEvent.keyDown(editable, { key: 'b', ctrlKey: true });
    expect(mockedFormatting.toggleExecFormat).toHaveBeenCalledWith('bold');
  });
});

describe('CustomEditor — paste handling', () => {
  it('pastes a clipboard file to onFiles', () => {
    const onFiles = vi.fn();
    const { editable } = renderEditor({ onFiles });
    const file = new File(['x'], 'pic.png', { type: 'image/png' });
    fireEvent.paste(editable, {
      clipboardData: {
        items: [
          {
            kind: 'file',
            getAsFile: () => file,
          },
        ],
        getData: () => '',
      },
    });
    expect(onFiles).toHaveBeenCalledWith([file]);
  });

  it('paste with HTML containing <img> fetches the image URL as a file', async () => {
    getImageUrlBlobMock.mockResolvedValueOnce(new Blob(['x'], { type: 'image/gif' }));
    const onFiles = vi.fn();
    const { editable } = renderEditor({ onFiles });
    fireEvent.paste(editable, {
      clipboardData: {
        items: [],
        getData: (type: string) =>
          type === 'text/html' ? '<div><img src="https://example.com/pic.gif"/></div>' : '',
      },
    });
    // fetchUrlAsFile is async; flush microtasks
    await act(async () => {
      await Promise.resolve();
    });
    expect(getImageUrlBlobMock).toHaveBeenCalledWith('https://example.com/pic.gif');
  });

  it('paste with plain text calls document.execCommand(insertText)', () => {
    // jsdom doesn't implement execCommand; install a mock, run, then remove.
    const execCommand = vi.fn().mockReturnValue(true);
    Object.defineProperty(document, 'execCommand', {
      value: execCommand,
      configurable: true,
      writable: true,
    });
    try {
      const { editable } = renderEditor();
      fireEvent.paste(editable, {
        clipboardData: {
          items: [],
          getData: (type: string) => (type === 'text/plain' ? 'pasted text' : ''),
        },
      });
      expect(execCommand).toHaveBeenCalledWith('insertText', false, 'pasted text');
    } finally {
      delete (document as unknown as { execCommand?: unknown }).execCommand;
    }
  });
});

describe('CustomEditor — input state sync', () => {
  it('dispatching an input event calls onChange and updates data-empty', () => {
    const onChange = vi.fn();
    const { editable } = renderEditor({ onChange });
    editable.appendChild(document.createTextNode('typed'));
    fireEvent.input(editable);
    expect(onChange).toHaveBeenCalled();
    expect(editable.hasAttribute('data-empty')).toBe(false);
  });

  it('clearing the contents flips data-empty back on', () => {
    const { editable } = renderEditor();
    editable.appendChild(document.createTextNode('typed'));
    fireEvent.input(editable);
    expect(editable.hasAttribute('data-empty')).toBe(false);
    editable.textContent = '';
    fireEvent.input(editable);
    expect(editable.hasAttribute('data-empty')).toBe(true);
  });
});
