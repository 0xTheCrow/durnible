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

  it('does not request focus on mobile / tablet (Slate path)', async () => {
    mobileOrTabletMock.mockReturnValue(true);
    setAlternateInput(false);

    await act(async () => {
      renderEditor();
    });

    expect(screen.getByTestId('editor-slate')).toBeInTheDocument();
    expect(reactEditorFocusSpy).not.toHaveBeenCalled();
  });

  it('does not focus the alternate input on mobile / tablet', async () => {
    mobileOrTabletMock.mockReturnValue(true);
    setAlternateInput(true);

    await act(async () => {
      renderEditor();
    });

    const alternateInput = screen.getByTestId('editor-alternate-input');
    expect(document.activeElement).not.toBe(alternateInput);
  });
});
