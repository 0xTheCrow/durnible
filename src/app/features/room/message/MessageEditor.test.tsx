import React from 'react';
import { render, screen, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ReactEditor } from 'slate-react';
import { getDefaultStore } from 'jotai';
import { MessageEditor } from './MessageEditor';
import { MatrixTestWrapper } from '../../../../test/wrapper';
import {
  createMockMatrixClient,
  createMockMatrixEvent,
  createMockRoom,
} from '../../../../test/mocks';
import { settingsAtom } from '../../../state/settings';

const { mobileOrTabletMock } = vi.hoisted(() => ({
  mobileOrTabletMock: vi.fn(() => false),
}));

vi.mock('../../../utils/user-agent', () => ({
  mobileOrTablet: mobileOrTabletMock,
}));

// jsdom doesn't implement HTMLElement.innerText. The alternateInput editor path
// in Editor.tsx reads `el.innerText` when syncing DOM — polyfill it to textContent
// so that code path doesn't throw during mount.
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

function renderEditor() {
  const mx = createMockMatrixClient();
  const room = createMockRoom('!testroom:example.com', mx);
  room._addMockMember('@alice:example.com', 'alice');

  const mEvent = createMockMatrixEvent({
    sender: '@alice:example.com',
    content: { body: 'Original content', msgtype: 'm.text' },
    roomId: '!testroom:example.com',
  });

  return render(
    <MatrixTestWrapper matrixClient={mx}>
      <MessageEditor
        roomId="!testroom:example.com"
        room={room as any}
        mEvent={mEvent}
        onCancel={vi.fn()}
      />
    </MatrixTestWrapper>
  );
}

const RICH_PLAIN_BODY = 'Hello Alice in #general :party:';
const RICH_FORMATTED_BODY =
  'Hello <a href="https://matrix.to/#/@alice:example.com">Alice</a> in <a href="https://matrix.to/#/#general:example.com">#general</a> <img data-mx-emoticon src="mxc://example.com/party" alt=":party:" title=":party:" />';

function renderRichEditor() {
  const mx = createMockMatrixClient();
  const room = createMockRoom('!testroom:example.com', mx);
  room._addMockMember('@alice:example.com', 'alice');

  const mEvent = createMockMatrixEvent({
    sender: '@alice:example.com',
    content: {
      body: RICH_PLAIN_BODY,
      msgtype: 'm.text',
      format: 'org.matrix.custom.html',
      formatted_body: RICH_FORMATTED_BODY,
    },
    roomId: '!testroom:example.com',
  });

  return render(
    <MatrixTestWrapper matrixClient={mx}>
      <MessageEditor
        roomId="!testroom:example.com"
        room={room as any}
        mEvent={mEvent}
        onCancel={vi.fn()}
      />
    </MatrixTestWrapper>
  );
}

function assertCaretCollapsedInside(el: HTMLElement) {
  const sel = window.getSelection();
  expect(sel).not.toBeNull();
  expect(sel!.rangeCount).toBe(1);
  const range = sel!.getRangeAt(0);
  expect(range.collapsed).toBe(true);
  expect(el.contains(range.endContainer)).toBe(true);
}

describe('MessageEditor auto-focus on mount', () => {
  let reactEditorFocusSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    mobileOrTabletMock.mockReturnValue(false);
    setAlternateInput(false);
    // Stub ReactEditor.focus so we can assert it was called without running
    // Slate's deferred setTimeout chain, which races against component teardown
    // in jsdom and leaks uncaught errors.
    reactEditorFocusSpy = vi.spyOn(ReactEditor, 'focus').mockImplementation(() => {});
  });

  afterEach(() => {
    reactEditorFocusSpy.mockRestore();
    setAlternateInput(false);
  });

  it('requests focus on the Slate editor when opened with alternateInput disabled', async () => {
    setAlternateInput(false);

    await act(async () => {
      renderEditor();
    });

    expect(screen.getByTestId('editor-slate')).toBeInTheDocument();
    expect(reactEditorFocusSpy).toHaveBeenCalled();
  });

  it('focuses the alternate input element when opened with alternateInput enabled', async () => {
    setAlternateInput(true);

    await act(async () => {
      renderEditor();
    });

    const alternateInput = screen.getByTestId('editor-alternate-input');
    expect(document.activeElement).toBe(alternateInput);
  });

  it('requests focus on the Slate editor on mobile / tablet', async () => {
    mobileOrTabletMock.mockReturnValue(true);
    setAlternateInput(false);

    await act(async () => {
      renderEditor();
    });

    expect(screen.getByTestId('editor-slate')).toBeInTheDocument();
    expect(reactEditorFocusSpy).toHaveBeenCalled();
  });

  it('focuses the alternate input on mobile / tablet', async () => {
    mobileOrTabletMock.mockReturnValue(true);
    setAlternateInput(true);

    await act(async () => {
      renderEditor();
    });

    const alternateInput = screen.getByTestId('editor-alternate-input');
    expect(document.activeElement).toBe(alternateInput);
  });
});

describe('MessageEditor content population on mount', () => {
  let reactEditorFocusSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    mobileOrTabletMock.mockReturnValue(false);
    setAlternateInput(false);
    reactEditorFocusSpy = vi.spyOn(ReactEditor, 'focus').mockImplementation(() => {});
  });

  afterEach(() => {
    reactEditorFocusSpy.mockRestore();
    setAlternateInput(false);
  });

  it('populates the alternate input with the original body and places the caret at the end (desktop)', async () => {
    setAlternateInput(true);

    await act(async () => {
      renderEditor();
    });

    const alternateInput = screen.getByTestId('editor-alternate-input');
    expect(alternateInput.textContent).toBe('Original content');

    const sel = window.getSelection();
    expect(sel).not.toBeNull();
    expect(sel!.rangeCount).toBe(1);
    const range = sel!.getRangeAt(0);
    expect(range.collapsed).toBe(true);
    expect(alternateInput.contains(range.endContainer)).toBe(true);
    if (range.endContainer === alternateInput) {
      expect(range.endOffset).toBe(alternateInput.childNodes.length);
    } else {
      expect(range.endContainer.nodeType).toBe(Node.TEXT_NODE);
      expect(range.endOffset).toBe((range.endContainer as Text).data.length);
    }
  });

  it('populates the alternate input on mobile and places the caret at the end', async () => {
    mobileOrTabletMock.mockReturnValue(true);
    setAlternateInput(true);

    await act(async () => {
      renderEditor();
    });

    const alternateInput = screen.getByTestId('editor-alternate-input');
    expect(alternateInput.textContent).toBe('Original content');
    expect(document.activeElement).toBe(alternateInput);

    const sel = window.getSelection();
    expect(sel).not.toBeNull();
    expect(sel!.rangeCount).toBe(1);
    const range = sel!.getRangeAt(0);
    expect(range.collapsed).toBe(true);
    expect(alternateInput.contains(range.endContainer)).toBe(true);
    if (range.endContainer === alternateInput) {
      expect(range.endOffset).toBe(alternateInput.childNodes.length);
    } else {
      expect(range.endContainer.nodeType).toBe(Node.TEXT_NODE);
      expect(range.endOffset).toBe((range.endContainer as Text).data.length);
    }
  });

  it('populates the Slate editor with the original body', async () => {
    setAlternateInput(false);

    await act(async () => {
      renderEditor();
    });

    const slate = screen.getByTestId('editor-slate');
    expect(slate.textContent).toBe('Original content');
  });
});

describe('MessageEditor rich content population on mount', () => {
  let reactEditorFocusSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    mobileOrTabletMock.mockReturnValue(false);
    setAlternateInput(false);
    reactEditorFocusSpy = vi.spyOn(ReactEditor, 'focus').mockImplementation(() => {});
  });

  afterEach(() => {
    reactEditorFocusSpy.mockRestore();
    setAlternateInput(false);
  });

  const assertRichAltInput = (alternateInput: HTMLElement) => {
    const mentions = alternateInput.querySelectorAll<HTMLElement>('[data-alt-type="mention"]');
    expect(mentions).toHaveLength(2);
    expect(mentions[0].dataset.id).toBe('@alice:example.com');
    expect(mentions[0].dataset.name).toBe('Alice');
    expect(mentions[0].textContent).toBe('Alice');
    expect(mentions[1].dataset.id).toBe('#general:example.com');
    expect(mentions[1].dataset.name).toBe('#general');
    expect(mentions[1].textContent).toBe('#general');

    const emoticons = alternateInput.querySelectorAll<HTMLElement>('[data-alt-type="emoticon"]');
    expect(emoticons).toHaveLength(1);
    expect(emoticons[0].dataset.key).toBe('mxc://example.com/party');
    expect(emoticons[0].dataset.shortcode).toBe(':party:');

    expect(alternateInput.textContent?.startsWith('Hello ')).toBe(true);
    expect(alternateInput.textContent).toContain(' in ');
  };

  it('renders formatted_body with mention, room link, and custom emoji on alt-input (desktop)', async () => {
    setAlternateInput(true);

    await act(async () => {
      renderRichEditor();
    });

    const alternateInput = screen.getByTestId('editor-alternate-input');
    assertRichAltInput(alternateInput);
    expect(document.activeElement).toBe(alternateInput);
    assertCaretCollapsedInside(alternateInput);
  });

  it('renders formatted_body with mention, room link, and custom emoji on alt-input (mobile)', async () => {
    mobileOrTabletMock.mockReturnValue(true);
    setAlternateInput(true);

    await act(async () => {
      renderRichEditor();
    });

    const alternateInput = screen.getByTestId('editor-alternate-input');
    assertRichAltInput(alternateInput);
    expect(document.activeElement).toBe(alternateInput);
    assertCaretCollapsedInside(alternateInput);
  });

  it('renders formatted_body with mention, room link, and custom emoji on Slate (desktop)', async () => {
    setAlternateInput(false);

    await act(async () => {
      renderRichEditor();
    });

    const slate = screen.getByTestId('editor-slate');

    const mentions = slate.querySelectorAll<HTMLElement>('[data-testid="slate-mention"]');
    expect(mentions).toHaveLength(2);
    const mentionIds = Array.from(mentions, (m) => m.dataset.mentionId);
    expect(mentionIds).toContain('@alice:example.com');
    expect(mentionIds).toContain('#general:example.com');

    const emoticons = slate.querySelectorAll<HTMLElement>('[data-testid="slate-emoticon"]');
    expect(emoticons).toHaveLength(1);
    expect(emoticons[0].dataset.emoticonKey).toBe('mxc://example.com/party');

    expect(slate.textContent).toContain('Hello ');
    expect(slate.textContent).toContain(' in ');
  });
});
