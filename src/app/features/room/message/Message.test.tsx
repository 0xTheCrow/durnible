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
import { LINKIFY_OPTS, getReactCustomHtmlParser } from '../../../plugins/react-custom-html-parser';

vi.mock('../../../utils/user-agent', () => ({
  mobileOrTablet: () => true,
}));

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

    expect(screen.queryByTestId('message-editor-save')).not.toBeInTheDocument();
    expect(screen.queryByTestId('message-editor-cancel')).not.toBeInTheDocument();

    // Flip edit prop — simulates MemoizedTimelineEvent receiving isEditing=true.
    // Drain Slate's deferred microtask state update with async act so it doesn't
    // escape the act() boundary and produce an "update not wrapped in act" warning.
    await act(async () => {
      rerender(
        <MatrixTestWrapper matrixClient={mx}>
          <Message {...baseProps} edit>
            <span>Original content</span>
          </Message>
        </MatrixTestWrapper>
      );
    });

    // Editor must appear immediately — no additional events should be needed
    expect(screen.getByTestId('message-editor-save')).toBeInTheDocument();
    expect(screen.getByTestId('message-editor-cancel')).toBeInTheDocument();
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
        <Message {...baseProps} edit>
          <span data-testid="test-message-child">Original content</span>
        </Message>
      </MatrixTestWrapper>
    );

    expect(screen.getByTestId('message-editor-save')).toBeInTheDocument();

    await act(async () => {
      rerender(
        <MatrixTestWrapper matrixClient={mx}>
          <Message {...baseProps} edit={false}>
            <span data-testid="test-message-child">Original content</span>
          </Message>
        </MatrixTestWrapper>
      );
    });

    expect(screen.queryByTestId('message-editor-save')).not.toBeInTheDocument();
    expect(screen.getByTestId('test-message-child')).toBeInTheDocument();
  });
});

describe('Message component', () => {
  describe('text messages', () => {
    it('renders body and sender name in modern layout', () => {
      renderMessage({
        body: 'Hello from Alice!',
        msgtype: MsgType.Text,
        sender: '@alice:example.com',
      });
      expect(screen.getByTestId('message-body')).toHaveTextContent('Hello from Alice!');
      expect(screen.getByTestId('message-sender-name')).toHaveTextContent('alice');
    });

    it('renders body in compact layout', () => {
      renderMessage({
        body: 'Compact message',
        msgtype: MsgType.Text,
        layout: MessageLayout.Compact,
      });
      expect(screen.getByTestId('message-body')).toHaveTextContent('Compact message');
    });

    it('renders body in bubble layout', () => {
      renderMessage({
        body: 'Bubble message',
        msgtype: MsgType.Text,
        layout: MessageLayout.Bubble,
      });
      expect(screen.getByTestId('message-body')).toHaveTextContent('Bubble message');
    });

    it('hides the sender name on a collapsed continuation message', () => {
      renderMessage({
        body: 'Continuation message',
        msgtype: MsgType.Text,
        collapse: true,
      });
      expect(screen.getByTestId('message-body')).toHaveTextContent('Continuation message');
      expect(screen.queryByTestId('message-sender-name')).not.toBeInTheDocument();
    });
  });

  describe('image messages', () => {
    it('renders an image message with sender name', () => {
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
      expect(screen.getByTestId('message-sender-name')).toHaveTextContent('bob');
    });
  });

  describe('emote messages', () => {
    it('renders an emote message body', () => {
      renderMessage({
        body: 'dances around',
        msgtype: MsgType.Emote,
        sender: '@charlie:example.com',
      });
      expect(screen.getByTestId('message-body')).toHaveTextContent('dances around');
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

      const htmlReactParserOptions = getReactCustomHtmlParser(mx as any, '!testroom:example.com', {
        linkifyOpts: LINKIFY_OPTS,
      });

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

      render(
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

      const bodies = screen.getAllByTestId('message-body');
      const senderNames = screen.getAllByTestId('message-sender-name');
      expect(bodies.map((el) => el.textContent)).toEqual(
        expect.arrayContaining([
          expect.stringContaining('Hi Bob!'),
          expect.stringContaining('Hey Alice!'),
        ])
      );
      expect(senderNames.map((el) => el.textContent)).toEqual(
        expect.arrayContaining(['Alice', 'Bob'])
      );
    });
  });
});
