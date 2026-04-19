import React from 'react';
import { render, screen, act, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MsgType, RelationType } from 'matrix-js-sdk';
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
  isMacOS: () => false,
}));

const ROOM_ID = '!testroom:example.com';
const EVENT_ID = '$event:example.com';

const renderEditor = (
  opts: {
    content?: Record<string, unknown>;
    onCancel?: () => void;
    enterForNewline?: boolean;
  } = {}
) => {
  if (opts.enterForNewline !== undefined) {
    const store = getDefaultStore();
    store.set(settingsAtom, { ...store.get(settingsAtom), enterForNewline: opts.enterForNewline });
  }

  const mx = createMockMatrixClient();
  const room = createMockRoom(ROOM_ID, mx);
  room._addMockMember('@alice:example.com', 'Alice');

  const mEvent = createMockMatrixEvent({
    id: EVENT_ID,
    sender: '@alice:example.com',
    content: opts.content ?? { body: 'original text', msgtype: MsgType.Text },
    roomId: ROOM_ID,
  });
  const onCancel = opts.onCancel ?? vi.fn();

  const utils = render(
    <MatrixTestWrapper matrixClient={mx}>
      <MessageEditor roomId={ROOM_ID} room={room as never} mEvent={mEvent} onCancel={onCancel} />
    </MatrixTestWrapper>
  );
  return { mx, room, mEvent, onCancel, ...utils };
};

const getEditor = () => screen.getByTestId('editor') as HTMLDivElement;

beforeEach(() => {
  mobileOrTabletMock.mockReturnValue(false);
  const store = getDefaultStore();
  store.set(settingsAtom, { ...store.get(settingsAtom), enterForNewline: false, isMarkdown: true });
});

describe('MessageEditor — mount & content hydration', () => {
  it('populates the editor with the prior message body', async () => {
    await act(async () => {
      renderEditor();
    });
    const editor = getEditor();
    expect(editor.textContent).toContain('original text');
  });

  it('focuses the editor and places the caret at the end on mount', async () => {
    await act(async () => {
      renderEditor();
    });
    const editor = getEditor();
    expect(document.activeElement).toBe(editor);
    const sel = window.getSelection();
    expect(sel).not.toBeNull();
    expect(sel!.rangeCount).toBe(1);
    expect(sel!.getRangeAt(0).collapsed).toBe(true);
    expect(editor.contains(sel!.getRangeAt(0).endContainer)).toBe(true);
  });

  it('hydrates formatted_body: mentions and emoticons survive as DOM nodes', async () => {
    await act(async () => {
      renderEditor({
        content: {
          body: 'hi Alice :smile:',
          msgtype: MsgType.Text,
          format: 'org.matrix.custom.html',
          formatted_body:
            'hi <a href="https://matrix.to/#/@alice:example.com">Alice</a> <img data-mx-emoticon src="mxc://example.com/smile" alt=":smile:" title=":smile:" />',
        },
      });
    });
    const editor = getEditor();
    const mentions = editor.querySelectorAll('[data-node-type="mention"]');
    expect(mentions.length).toBe(1);
    expect((mentions[0] as HTMLElement).dataset.id).toBe('@alice:example.com');
    const emoticons = editor.querySelectorAll('[data-node-type="emoticon"]');
    expect(emoticons.length).toBe(1);
    expect((emoticons[0] as HTMLElement).dataset.shortcode).toBe(':smile:');
  });
});

describe('MessageEditor — save path', () => {
  it('clicking Save dispatches sendMessage with the replacement content shape', async () => {
    const { mx } = await act(async () => renderEditor());
    const editor = getEditor();
    editor.textContent = 'edited text';
    fireEvent.input(editor);
    await act(async () => {
      fireEvent.click(screen.getByTestId('message-editor-save'));
    });
    expect(mx.sendMessage).toHaveBeenCalledTimes(1);
    const [[roomId, content]] = (mx.sendMessage as ReturnType<typeof vi.fn>).mock.calls;
    expect(roomId).toBe(ROOM_ID);
    expect(content.body).toBe('* edited text');
    expect(content.msgtype).toBe(MsgType.Text);
    expect(content['m.new_content']).toMatchObject({
      body: 'edited text',
      msgtype: MsgType.Text,
    });
    expect(content['m.relates_to']).toEqual({
      event_id: EVENT_ID,
      rel_type: RelationType.Replace,
    });
  });

  it('does not call sendMessage when the content is unchanged', async () => {
    const { mx } = await act(async () => renderEditor());
    await act(async () => {
      fireEvent.click(screen.getByTestId('message-editor-save'));
    });
    expect(mx.sendMessage).not.toHaveBeenCalled();
  });

  it('save after successful send calls onCancel', async () => {
    const { onCancel } = await act(async () => renderEditor());
    const editor = getEditor();
    editor.textContent = 'updated';
    fireEvent.input(editor);
    await act(async () => {
      fireEvent.click(screen.getByTestId('message-editor-save'));
    });
    // wait for async send-then-cancel effect
    await act(async () => {
      await Promise.resolve();
    });
    expect(onCancel).toHaveBeenCalled();
  });
});

describe('MessageEditor — cancel path', () => {
  it('clicking Cancel calls onCancel', async () => {
    const { onCancel } = await act(async () => renderEditor());
    fireEvent.click(screen.getByTestId('message-editor-cancel'));
    expect(onCancel).toHaveBeenCalled();
  });

  it('Escape calls onCancel', async () => {
    const { onCancel } = await act(async () => renderEditor());
    fireEvent.keyDown(getEditor(), { key: 'Escape' });
    expect(onCancel).toHaveBeenCalled();
  });
});

describe('MessageEditor — keyboard shortcuts for save', () => {
  it('Mod+Enter triggers save', async () => {
    const { mx } = await act(async () => renderEditor());
    const editor = getEditor();
    editor.textContent = 'via cmd enter';
    fireEvent.input(editor);
    await act(async () => {
      fireEvent.keyDown(editor, { key: 'Enter', ctrlKey: true });
    });
    expect(mx.sendMessage).toHaveBeenCalledTimes(1);
  });

  it('Enter alone triggers save when enterForNewline is false', async () => {
    const { mx } = await act(async () => renderEditor({ enterForNewline: false }));
    const editor = getEditor();
    editor.textContent = 'plain enter';
    fireEvent.input(editor);
    await act(async () => {
      fireEvent.keyDown(editor, { key: 'Enter' });
    });
    expect(mx.sendMessage).toHaveBeenCalledTimes(1);
  });

  it('Enter does not trigger save when enterForNewline is true', async () => {
    const { mx } = await act(async () => renderEditor({ enterForNewline: true }));
    const editor = getEditor();
    editor.textContent = 'plain enter newline';
    fireEvent.input(editor);
    await act(async () => {
      fireEvent.keyDown(editor, { key: 'Enter' });
    });
    expect(mx.sendMessage).not.toHaveBeenCalled();
  });
});
