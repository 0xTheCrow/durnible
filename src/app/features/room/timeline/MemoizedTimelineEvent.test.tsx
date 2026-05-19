import React, { useState } from 'react';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { MsgType } from 'matrix-js-sdk';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoizedTimelineEvent } from './MemoizedTimelineEvent';
import type { TimelineMessageContextValue } from './TimelineMessageContext';
import { TimelineMessageContext } from './TimelineMessageContext';
import { MatrixTestWrapper } from '../../../../test/wrapper';
import {
  createMockMatrixClient,
  createMockMatrixEvent,
  createMockRoom,
} from '../../../../test/mocks';
import { MessageLayout } from '../../../state/settings';
import { LINKIFY_OPTS, getReactCustomHtmlParser } from '../../../plugins/react-custom-html-parser';

// Slate's focus() fires via setTimeout after mounting. Use fake timers so it
// never runs against a torn-down DOM and produces spurious unhandled errors.
beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

function makeContext(
  mx: ReturnType<typeof createMockMatrixClient>,
  room: ReturnType<typeof createMockRoom>
): TimelineMessageContextValue {
  const htmlReactParserOptions = getReactCustomHtmlParser(mx as any, '!testroom:example.com', {
    linkifyOpts: LINKIFY_OPTS,
  });

  return {
    room: room as any,
    mx: mx as any,
    messageLayout: MessageLayout.Modern,
    messageSpacing: '400',
    mediaAutoLoad: false,
    showUrlPreview: false,
    canRedact: false,
    canSendReaction: false,
    canPinEvent: false,
    imagePackRooms: [],
    getMemberPowerTag: vi.fn(() => ({ name: 'Member' })),
    accessiblePowerTagColors: new Map(),
    legacyUsernameColor: false,
    direct: false,
    hideReadReceipts: false,
    showDeveloperTools: false,
    hour24Clock: false,
    dateFormatString: '',
    htmlReactParserOptions,
    linkifyOpts: LINKIFY_OPTS,
    replyHighlight: false,
    showHiddenEvents: false,
    hideMembershipEvents: false,
    hideNickAvatarEvents: false,
    handleUserClick: vi.fn(),
    handleUsernameClick: vi.fn(),
    handleReplyClick: vi.fn(),
    handleReactionToggle: vi.fn(),
    editId: undefined,
    handleEdit: vi.fn(),
    handleOpenReply: vi.fn(),
    handleDecryptRetry: vi.fn(async () => {}),
  };
}

function makeTimelineSet() {
  return {
    findEventById: vi.fn(() => undefined),
  } as any;
}

describe('MemoizedTimelineEvent edit mode', () => {
  it('re-renders immediately when isEditing flips to true — memo comparator must not bail out', async () => {
    const mx = createMockMatrixClient();
    const room = createMockRoom('!testroom:example.com', mx);
    room._addMockMember('@alice:example.com', 'alice');

    const mEvent = createMockMatrixEvent({
      id: '$event-edit-test',
      sender: '@alice:example.com',
      content: { body: 'Hello world', msgtype: MsgType.Text },
      roomId: '!testroom:example.com',
    });

    const ctx = makeContext(mx, room);
    const timelineSet = makeTimelineSet();

    const baseProps = {
      mEvent,
      mEventId: '$event-edit-test',
      timelineSet,
      item: 0,
      collapsed: false,
      isHighlighted: false,
      reactionRelations: undefined,
      editedEvent: undefined,
      isRedacted: false,
      eventStatus: null,
      replyToMe: false,
    };

    const { rerender } = render(
      <MatrixTestWrapper matrixClient={mx}>
        <TimelineMessageContext.Provider value={ctx}>
          <MemoizedTimelineEvent {...baseProps} isEditing={false} />
        </TimelineMessageContext.Provider>
      </MatrixTestWrapper>
    );

    expect(screen.getByTestId('message-body')).toHaveTextContent('Hello world');
    expect(screen.queryByTestId('message-editor-save')).not.toBeInTheDocument();
    expect(screen.queryByTestId('message-editor-cancel')).not.toBeInTheDocument();

    // Flip isEditing — simulates editId matching this event's ID in RoomTimeline.
    // Drain Slate's deferred microtask state update with async act.
    await act(async () => {
      rerender(
        <MatrixTestWrapper matrixClient={mx}>
          <TimelineMessageContext.Provider value={ctx}>
            <MemoizedTimelineEvent {...baseProps} isEditing />
          </TimelineMessageContext.Provider>
        </MatrixTestWrapper>
      );
    });

    // Editor must appear immediately — the memo comparator must detect isEditing changed.
    // If this fails, the comparator is incorrectly returning true (equal) and bailing out.
    expect(screen.getByTestId('message-editor-save')).toBeInTheDocument();
    expect(screen.getByTestId('message-editor-cancel')).toBeInTheDocument();
  });

  it('removes the editor immediately when isEditing flips back to false', () => {
    const mx = createMockMatrixClient();
    const room = createMockRoom('!testroom:example.com', mx);
    room._addMockMember('@alice:example.com', 'alice');

    const mEvent = createMockMatrixEvent({
      id: '$event-cancel-test',
      sender: '@alice:example.com',
      content: { body: 'Hello world', msgtype: MsgType.Text },
      roomId: '!testroom:example.com',
    });

    const ctx = makeContext(mx, room);
    const timelineSet = makeTimelineSet();

    const baseProps = {
      mEvent,
      mEventId: '$event-cancel-test',
      timelineSet,
      item: 0,
      collapsed: false,
      isHighlighted: false,
      reactionRelations: undefined,
      editedEvent: undefined,
      isRedacted: false,
      eventStatus: null,
      replyToMe: false,
    };

    const { rerender } = render(
      <MatrixTestWrapper matrixClient={mx}>
        <TimelineMessageContext.Provider value={ctx}>
          <MemoizedTimelineEvent {...baseProps} isEditing />
        </TimelineMessageContext.Provider>
      </MatrixTestWrapper>
    );

    expect(screen.getByTestId('message-editor-save')).toBeInTheDocument();

    rerender(
      <MatrixTestWrapper matrixClient={mx}>
        <TimelineMessageContext.Provider value={ctx}>
          <MemoizedTimelineEvent {...baseProps} isEditing={false} />
        </TimelineMessageContext.Provider>
      </MatrixTestWrapper>
    );

    expect(screen.queryByTestId('message-editor-save')).not.toBeInTheDocument();
    expect(screen.getByTestId('message-body')).toHaveTextContent('Hello world');
  });
});

describe('MemoizedTimelineEvent reply-to-me highlight', () => {
  // Regression test for the "no highlight on first load" bug.
  //
  // The bug: replyToMe used to be computed inline inside MemoizedTimelineEvent
  // via timelineSet.findEventById(replyEventId). On page refresh, the ancestor
  // event was often older than the loaded pagination window, so findEventById
  // returned undefined and the highlight was missing on first paint. The user
  // had to scroll (which tripped the memo comparator) for the highlight to
  // appear.
  //
  // The fix: replyToMe is now a prop computed in the parent (RoomTimeline),
  // so it doesn't depend on the SDK having the ancestor loaded at the moment
  // of the child's first render — and the parent re-runs the computation
  // whenever it re-renders (including on the new backpagination notification).
  //
  // This test pins the behavior: even when timelineSet.findEventById returns
  // undefined (ancestor not loaded), passing replyToMe=true must produce a
  // visible highlight on the FIRST render with no further interactions.
  it('shows the highlight on first render even when findEventById returns undefined', () => {
    const mx = createMockMatrixClient();
    const room = createMockRoom('!testroom:example.com', mx);
    room._addMockMember('@alice:example.com', 'alice');

    const mEvent = createMockMatrixEvent({
      id: '$reply-event',
      sender: '@alice:example.com',
      content: { body: 'thanks!', msgtype: MsgType.Text },
      roomId: '!testroom:example.com',
    });
    // Make this a reply to an ancestor that won't be in the timelineSet — the
    // exact bug scenario from page refresh.
    (mEvent as any).replyEventId = '$missing-ancestor';

    const ctx: TimelineMessageContextValue = {
      ...makeContext(mx, room),
      // The bubble is gated on the user's setting too; turn it on so the test
      // exercises the prop path that drives mentionHighlight.
      replyHighlight: true,
    };
    const timelineSet = makeTimelineSet(); // findEventById returns undefined
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });

    const { container } = render(
      <MatrixTestWrapper matrixClient={mx}>
        <QueryClientProvider client={queryClient}>
          <TimelineMessageContext.Provider value={ctx}>
            <MemoizedTimelineEvent
              mEvent={mEvent}
              mEventId="$reply-event"
              timelineSet={timelineSet}
              item={0}
              collapsed={false}
              isHighlighted={false}
              isEditing={false}
              reactionRelations={undefined}
              editedEvent={undefined}
              isRedacted={false}
              eventStatus={null}
              replyToMe
            />
          </TimelineMessageContext.Provider>
        </QueryClientProvider>
      </MatrixTestWrapper>
    );

    // MessageBase exposes a `data-mention-highlight` attribute when the
    // variant is on. If the prop didn't flow through, no element would have
    // it.
    expect(container.querySelector('[data-mention-highlight]')).not.toBeNull();
  });

  it('does not show the highlight when replyToMe is false', () => {
    const mx = createMockMatrixClient();
    const room = createMockRoom('!testroom:example.com', mx);
    room._addMockMember('@alice:example.com', 'alice');

    const mEvent = createMockMatrixEvent({
      id: '$plain-event',
      sender: '@alice:example.com',
      content: { body: 'just a message', msgtype: MsgType.Text },
      roomId: '!testroom:example.com',
    });

    const ctx: TimelineMessageContextValue = {
      ...makeContext(mx, room),
      replyHighlight: true,
    };
    const timelineSet = makeTimelineSet();

    const { container } = render(
      <MatrixTestWrapper matrixClient={mx}>
        <TimelineMessageContext.Provider value={ctx}>
          <MemoizedTimelineEvent
            mEvent={mEvent}
            mEventId="$plain-event"
            timelineSet={timelineSet}
            item={0}
            collapsed={false}
            isHighlighted={false}
            isEditing={false}
            reactionRelations={undefined}
            editedEvent={undefined}
            isRedacted={false}
            eventStatus={null}
            replyToMe={false}
          />
        </TimelineMessageContext.Provider>
      </MatrixTestWrapper>
    );

    expect(container.querySelector('[data-mention-highlight]')).toBeNull();
  });
});

describe('MemoizedTimelineEvent edit — full handleEdit chain', () => {
  // Tests the real bug path: handleEdit lives in context, gets called, updates
  // editId state in a parent (like RoomTimeline), which re-renders and passes
  // isEditing=true as a prop. If the memo comparator bails out, or the prop
  // never arrives, the editor won't appear without a separate trigger.
  it('shows the editor after handleEdit state update — no manual rerender needed', async () => {
    const mx = createMockMatrixClient();
    const room = createMockRoom('!testroom:example.com', mx);
    room._addMockMember('@me:example.com', 'me');

    const mEvent = createMockMatrixEvent({
      id: '$event-chain-test',
      sender: '@me:example.com',
      content: { body: 'Edit me', msgtype: MsgType.Text },
      roomId: '!testroom:example.com',
    });

    const htmlReactParserOptions = getReactCustomHtmlParser(mx as any, '!testroom:example.com', {
      linkifyOpts: LINKIFY_OPTS,
    });

    // Wrapper owns editId state exactly as RoomTimeline does.
    // A test button calls handleEdit directly — simulating the edit button click
    // without needing to hover over the message (which requires mouse interaction).
    function Wrapper() {
      const [editId, setEditId] = useState<string | undefined>(undefined);

      const handleEdit = (editEvtId?: string) => setEditId(editEvtId);

      const ctx: TimelineMessageContextValue = {
        room: room as any,
        mx: mx as any,
        messageLayout: MessageLayout.Modern,
        messageSpacing: '400',
        mediaAutoLoad: false,
        showUrlPreview: false,
        canRedact: true,
        canSendReaction: false,
        canPinEvent: false,
        imagePackRooms: [],
        getMemberPowerTag: vi.fn(() => ({ name: 'Member' })),
        accessiblePowerTagColors: new Map(),
        legacyUsernameColor: false,
        direct: false,
        hideReadReceipts: false,
        showDeveloperTools: false,
        hour24Clock: false,
        dateFormatString: '',
        htmlReactParserOptions,
        linkifyOpts: LINKIFY_OPTS,
        replyHighlight: false,
        showHiddenEvents: false,
        hideMembershipEvents: false,
        hideNickAvatarEvents: false,
        handleUserClick: vi.fn(),
        handleUsernameClick: vi.fn(),
        handleReplyClick: vi.fn(),
        handleReactionToggle: vi.fn(),
        editId,
        handleEdit,
        handleOpenReply: vi.fn(),
        handleDecryptRetry: vi.fn(async () => {}),
      };

      return (
        <TimelineMessageContext.Provider value={ctx}>
          {/* Trigger button simulates the edit button's onClick in Message:
              onEditId(mEvent.getId()) → handleEdit(eventId) → setEditId */}
          <button
            type="button"
            data-testid="trigger-edit"
            onClick={() => handleEdit('$event-chain-test')}
          >
            Trigger Edit
          </button>
          <MemoizedTimelineEvent
            mEvent={mEvent}
            mEventId="$event-chain-test"
            timelineSet={{ findEventById: vi.fn(() => undefined) } as any}
            item={0}
            collapsed={false}
            isHighlighted={false}
            isEditing={editId === '$event-chain-test'}
            reactionRelations={undefined}
            editedEvent={undefined}
            isRedacted={false}
            eventStatus={null}
            replyToMe={false}
          />
        </TimelineMessageContext.Provider>
      );
    }

    render(
      <MatrixTestWrapper matrixClient={mx}>
        <Wrapper />
      </MatrixTestWrapper>
    );

    expect(screen.getByTestId('message-body')).toHaveTextContent('Edit me');
    expect(screen.queryByTestId('message-editor-save')).not.toBeInTheDocument();

    // Fire the trigger — state updates, Wrapper re-renders, isEditing becomes
    // true. The editor must appear from this single state update with no
    // additional events. This is the path that intermittently failed in prod.
    await act(async () => {
      fireEvent.click(screen.getByTestId('trigger-edit'));
    });

    expect(screen.getByTestId('message-editor-save')).toBeInTheDocument();
    expect(screen.getByTestId('message-editor-cancel')).toBeInTheDocument();
  });
});
