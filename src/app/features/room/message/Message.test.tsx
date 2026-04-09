// Prevents ReactEditor.focus() from firing asynchronously after component
// unmount, which causes "Cannot resolve a DOM node from Slate node" errors.
vi.mock('../../../utils/user-agent', () => ({
  mobileOrTablet: () => true,
}));

import React from 'react';
import { render, screen, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { MsgType } from 'matrix-js-sdk';
import { Message } from './Message';
import { RenderMessageContent } from '../../../components/RenderMessageContent';
import { MatrixTestWrapper } from '../../../../test/wrapper';
import {
  createMockMatrixClient,
  createMockMatrixEvent,
  createMockRoom,
} from '../../../../test/mocks';
import { MessageLayout } from '../../../state/settings';
import {
  LINKIFY_OPTS,
  getReactCustomHtmlParser,
} from '../../../plugins/react-custom-html-parser';

function renderMessage(opts: {
  body: string;
  msgtype: string;
  sender?: string;
  collapse?: boolean;
  layout?: MessageLayout;
  content?: Record<string, unknown>;
}) {
  const mx = createMockMatrixClient();
  const room = createMockRoom('!testroom:example.com', mx);
  const sender = opts.sender ?? '@alice:example.com';
  room._addMockMember(sender, sender.split(':')[0].slice(1));

  const content = opts.content ?? { body: opts.body, msgtype: opts.msgtype };
  const mEvent = createMockMatrixEvent({
    sender,
    content,
    roomId: '!testroom:example.com',
  });

  const htmlReactParserOptions = getReactCustomHtmlParser(mx as any, '!testroom:example.com', {
    linkifyOpts: LINKIFY_OPTS,
  });

  return render(
    <MatrixTestWrapper matrixClient={mx}>
      <Message
        room={room as any}
        mEvent={mEvent}
        collapse={opts.collapse ?? false}
        highlight={false}
        mentionHighlight={false}
        edit={false}
        canDelete={false}
        canSendReaction={false}
        canPinEvent={false}
        messageLayout={opts.layout ?? MessageLayout.Modern}
        messageSpacing="400"
        onUserClick={vi.fn()}
        onUsernameClick={vi.fn()}
        onReplyClick={vi.fn()}
        onReactionToggle={vi.fn()}
        hour24Clock={false}
        dateFormatString=""
      >
        <RenderMessageContent
          displayName={sender.split(':')[0].slice(1)}
          msgType={opts.msgtype}
          content={content as any}
          mediaAutoLoad={false}
          urlPreview={false}
          htmlReactParserOptions={htmlReactParserOptions}
          linkifyOpts={LINKIFY_OPTS}
        />
      </Message>
    </MatrixTestWrapper>
  );
}

describe('edit mode', () => {
  // Slate schedules a focus() via setTimeout after mounting. Use fake timers so
  // that callback never fires against a torn-down DOM and produces spurious errors.
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());
  it('shows the editor immediately when edit prop flips to true', async () => {
    const mx = createMockMatrixClient();
    const room = createMockRoom('!testroom:example.com', mx);
    room._addMockMember('@alice:example.com', 'alice');

    const mEvent = createMockMatrixEvent({
      sender: '@alice:example.com',
      content: { body: 'Original content', msgtype: 'm.text' },
      roomId: '!testroom:example.com',
    });

    const onEditId = vi.fn();

    const baseProps = {
      room: room as any,
      mEvent,
      collapse: false,
      highlight: false,
      mentionHighlight: false,
      canDelete: false,
      canSendReaction: false,
      canPinEvent: false,
      messageLayout: MessageLayout.Modern,
      messageSpacing: '400' as const,
      onUserClick: vi.fn(),
      onUsernameClick: vi.fn(),
      onReplyClick: vi.fn(),
      onReactionToggle: vi.fn(),
      onEditId,
      hour24Clock: false,
      dateFormatString: '',
    };

    const { rerender } = render(
      <MatrixTestWrapper matrixClient={mx}>
        <Message {...baseProps} edit={false}>
          <span>Original content</span>
        </Message>
      </MatrixTestWrapper>
    );

    // Content is visible, editor is not
    expect(screen.getByText('Original content')).toBeInTheDocument();
    expect(screen.queryByText('Save')).not.toBeInTheDocument();
    expect(screen.queryByText('Cancel')).not.toBeInTheDocument();

    // Flip edit prop — simulates MemoizedTimelineEvent receiving isEditing=true.
    // Drain Slate's deferred microtask state update with async act so it doesn't
    // escape the act() boundary and produce an "update not wrapped in act" warning.
    await act(async () => {
      rerender(
        <MatrixTestWrapper matrixClient={mx}>
          <Message {...baseProps} edit={true}>
            <span>Original content</span>
          </Message>
        </MatrixTestWrapper>
      );
    });

    // Editor must appear immediately — no additional events should be needed
    expect(screen.getByText('Save')).toBeInTheDocument();
    expect(screen.getByText('Cancel')).toBeInTheDocument();
    // Note: the Slate editor is pre-populated with the original content, so the
    // text is still present in the DOM (as a slate node) — don't assert its absence.
  });

  it('hides the editor and restores content when edit prop flips back to false', async () => {
    const mx = createMockMatrixClient();
    const room = createMockRoom('!testroom:example.com', mx);
    room._addMockMember('@alice:example.com', 'alice');

    const mEvent = createMockMatrixEvent({
      sender: '@alice:example.com',
      content: { body: 'Original content', msgtype: 'm.text' },
      roomId: '!testroom:example.com',
    });

    const onEditId = vi.fn();

    const baseProps = {
      room: room as any,
      mEvent,
      collapse: false,
      highlight: false,
      mentionHighlight: false,
      canDelete: false,
      canSendReaction: false,
      canPinEvent: false,
      messageLayout: MessageLayout.Modern,
      messageSpacing: '400' as const,
      onUserClick: vi.fn(),
      onUsernameClick: vi.fn(),
      onReplyClick: vi.fn(),
      onReactionToggle: vi.fn(),
      onEditId,
      hour24Clock: false,
      dateFormatString: '',
    };

    const { rerender } = render(
      <MatrixTestWrapper matrixClient={mx}>
        <Message {...baseProps} edit={true}>
          <span>Original content</span>
        </Message>
      </MatrixTestWrapper>
    );

    expect(screen.getByText('Save')).toBeInTheDocument();

    await act(async () => {
      rerender(
        <MatrixTestWrapper matrixClient={mx}>
          <Message {...baseProps} edit={false}>
            <span>Original content</span>
          </Message>
        </MatrixTestWrapper>
      );
    });

    expect(screen.queryByText('Save')).not.toBeInTheDocument();
    expect(screen.getByText('Original content')).toBeInTheDocument();
  });
});

describe('Message component', () => {
  describe('text messages', () => {
    it('renders a text message in modern layout', () => {
      renderMessage({
        body: 'Hello from Alice!',
        msgtype: MsgType.Text,
        sender: '@alice:example.com',
      });
      expect(screen.getByText('Hello from Alice!')).toBeInTheDocument();
      expect(screen.getByText('alice')).toBeInTheDocument();
    });

    it('renders a text message in compact layout', () => {
      renderMessage({
        body: 'Compact message',
        msgtype: MsgType.Text,
        layout: MessageLayout.Compact,
      });
      expect(screen.getByText('Compact message')).toBeInTheDocument();
    });

    it('renders a text message in bubble layout', () => {
      renderMessage({
        body: 'Bubble message',
        msgtype: MsgType.Text,
        layout: MessageLayout.Bubble,
      });
      expect(screen.getByText('Bubble message')).toBeInTheDocument();
    });

    it('renders a collapsed message (same sender continuation)', () => {
      renderMessage({
        body: 'Continuation message',
        msgtype: MsgType.Text,
        collapse: true,
      });
      expect(screen.getByText('Continuation message')).toBeInTheDocument();
      // Username should NOT be shown when collapsed
      expect(screen.queryByText('alice')).not.toBeInTheDocument();
    });
  });

  describe('image messages', () => {
    it('renders an image message without crashing', () => {
      renderMessage({
        body: 'photo.png',
        msgtype: MsgType.Image,
        sender: '@bob:example.com',
        content: {
          body: 'photo.png',
          msgtype: 'm.image',
          url: 'mxc://example.com/photo123',
          info: {
            w: 1024,
            h: 768,
            size: 102400,
            mimetype: 'image/png',
          },
        },
      });
      expect(screen.getByText('bob')).toBeInTheDocument();
    });
  });

  describe('emote messages', () => {
    it('renders an emote message', () => {
      renderMessage({
        body: 'dances around',
        msgtype: MsgType.Emote,
        sender: '@charlie:example.com',
      });
      expect(screen.getByText(/dances around/)).toBeInTheDocument();
    });
  });

  describe('multiple senders', () => {
    it('renders messages from different users', () => {
      const mx = createMockMatrixClient();
      const room = createMockRoom('!testroom:example.com', mx);
      room._addMockMember('@alice:example.com', 'Alice');
      room._addMockMember('@bob:example.com', 'Bob');

      const aliceEvent = createMockMatrixEvent({
        sender: '@alice:example.com',
        content: { body: 'Hi Bob!', msgtype: 'm.text' },
        roomId: '!testroom:example.com',
      });

      const bobEvent = createMockMatrixEvent({
        sender: '@bob:example.com',
        content: { body: 'Hey Alice!', msgtype: 'm.text' },
        roomId: '!testroom:example.com',
      });

      const htmlReactParserOptions = getReactCustomHtmlParser(
        mx as any,
        '!testroom:example.com',
        { linkifyOpts: LINKIFY_OPTS }
      );

      const messageProps = {
        room: room as any,
        collapse: false,
        highlight: false,
        mentionHighlight: false,
        edit: false,
        canDelete: false,
        canSendReaction: false,
        canPinEvent: false,
        messageLayout: MessageLayout.Modern,
        messageSpacing: '400' as const,
        onUserClick: vi.fn(),
        onUsernameClick: vi.fn(),
        onReplyClick: vi.fn(),
        onReactionToggle: vi.fn(),
        hour24Clock: false,
        dateFormatString: '',
      };

      const { rerender } = render(
        <MatrixTestWrapper matrixClient={mx}>
          <Message {...messageProps} mEvent={aliceEvent}>
            <RenderMessageContent
              displayName="Alice"
              msgType={MsgType.Text}
                  content={aliceEvent.getContent() as any}
              mediaAutoLoad={false}
              urlPreview={false}
              htmlReactParserOptions={htmlReactParserOptions}
              linkifyOpts={LINKIFY_OPTS}
            />
          </Message>
          <Message {...messageProps} mEvent={bobEvent}>
            <RenderMessageContent
              displayName="Bob"
              msgType={MsgType.Text}
                  content={bobEvent.getContent() as any}
              mediaAutoLoad={false}
              urlPreview={false}
              htmlReactParserOptions={htmlReactParserOptions}
              linkifyOpts={LINKIFY_OPTS}
            />
          </Message>
        </MatrixTestWrapper>
      );

      expect(screen.getByText('Hi Bob!')).toBeInTheDocument();
      expect(screen.getByText('Hey Alice!')).toBeInTheDocument();
      expect(screen.getByText('Alice')).toBeInTheDocument();
      expect(screen.getByText('Bob')).toBeInTheDocument();
    });
  });
});
