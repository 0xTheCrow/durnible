import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import type { MatrixEvent } from 'matrix-js-sdk';
import { RelationType, EventType, MsgType } from 'matrix-js-sdk';
import type { Relations } from 'matrix-js-sdk/lib/models/relations';

import { MessageDeleteItem } from './Message';
import { MessageEditor } from './MessageEditor';
import { Reactions } from './Reactions';

import { MatrixTestWrapper } from '../../../../test/wrapper';
import {
  createMockMatrixClient,
  createMockMatrixEvent,
  createMockRoom,
} from '../../../../test/mocks';

// focus-trap needs real layout to find tabbable nodes; it throws in the test DOM.
vi.mock('focus-trap-react', () => ({
  default: ({ children }: { children: React.ReactNode }) => children,
}));

vi.mock('../../../utils/user-agent', () => ({
  mobileOrTablet: () => true,
}));

function createMockReactionEvent(sender: string, key: string, targetEventId: string): MatrixEvent {
  const event = createMockMatrixEvent({
    id: `$reaction-${key}-${sender}`,
    sender,
    type: EventType.Reaction,
    content: {
      'm.relates_to': { key, rel_type: RelationType.Annotation, event_id: targetEventId },
    },
  });
  // getRelation is not in the base mock — add it so Reactions can read the emoji key.
  (event as any).getRelation = vi.fn(() => ({
    key,
    rel_type: RelationType.Annotation,
    event_id: targetEventId,
  }));
  return event;
}

function createMockRelations(events: MatrixEvent[]): Relations {
  return {
    getRelations: vi.fn(() => events),
    getSortedAnnotationsByKey: vi.fn(() => []),
    on: vi.fn().mockReturnThis(),
    off: vi.fn().mockReturnThis(),
    removeListener: vi.fn().mockReturnThis(),
  } as unknown as Relations;
}

const ROOM_ID = '!testroom:example.com';
const EVENT_ID = '$target:example.com';
const THUMBS_UP = '👍';

describe('message deletion (MessageDeleteItem)', () => {
  function renderDeleteItem(overrides?: { rejectOnce?: boolean }) {
    const mx = createMockMatrixClient();
    if (overrides?.rejectOnce) {
      (mx.redactEvent as any).mockImplementationOnce(async () => {
        throw new Error('Network error');
      });
    }
    const room = createMockRoom(ROOM_ID, mx);
    const mEvent = createMockMatrixEvent({ id: EVENT_ID });

    render(
      <MatrixTestWrapper matrixClient={mx}>
        <MessageDeleteItem room={room as any} mEvent={mEvent} />
      </MatrixTestWrapper>
    );

    return { mx };
  }

  it('renders a Delete button', () => {
    renderDeleteItem();
    expect(screen.getByTestId('message-delete-btn')).toBeInTheDocument();
  });

  it('opens a confirmation dialog when the Delete button is clicked', () => {
    renderDeleteItem();

    fireEvent.click(screen.getByTestId('message-delete-btn'));

    expect(screen.getByTestId('message-delete-dialog')).toBeInTheDocument();
    expect(screen.getByTestId('message-delete-dialog-title')).toBeInTheDocument();
    expect(screen.getByTestId('message-delete-confirm')).toBeInTheDocument();
  });

  it('calls redactEvent with the event ID when confirmed without a reason', async () => {
    const { mx } = renderDeleteItem();

    fireEvent.click(screen.getByTestId('message-delete-btn'));
    await act(async () => {
      fireEvent.submit(screen.getByTestId('message-delete-dialog'));
    });

    expect(mx.redactEvent).toHaveBeenCalled();
    const [roomId, eventId, , opts] = (mx.redactEvent as any).mock.calls[0];
    expect(roomId).toBe(ROOM_ID);
    expect(eventId).toBe(EVENT_ID);
    expect(opts?.reason).toBeUndefined();
  });

  it('passes the typed reason to redactEvent', async () => {
    const { mx } = renderDeleteItem();

    fireEvent.click(screen.getByTestId('message-delete-btn'));

    const form = screen.getByTestId('message-delete-dialog') as HTMLFormElement;
    const reasonInput = form.querySelector('input[name="reasonInput"]') as HTMLInputElement;
    fireEvent.change(reasonInput, { target: { value: 'Spam' } });
    await act(async () => {
      fireEvent.submit(form);
    });

    expect(mx.redactEvent).toHaveBeenCalled();
    const [roomId, eventId, , opts] = (mx.redactEvent as any).mock.calls[0];
    expect(roomId).toBe(ROOM_ID);
    expect(eventId).toBe(EVENT_ID);
    expect(opts?.reason).toBe('Spam');
  });

  it('shows an error message when the deletion request fails', async () => {
    // useAsyncCallback re-throws after setting error state; handleSubmit is
    // fire-and-forget so the re-throw becomes an unhandled rejection. Register
    // a handler before the submit so it is explicitly caught here.
    const rejectionHandled = new Promise<void>((resolve) => {
      process.once('unhandledRejection', () => resolve());
    });

    renderDeleteItem({ rejectOnce: true });
    fireEvent.click(screen.getByTestId('message-delete-btn'));
    fireEvent.submit(screen.getByTestId('message-delete-dialog'));

    await Promise.all([
      rejectionHandled,
      waitFor(() => {
        expect(screen.getByTestId('message-delete-error')).toBeInTheDocument();
      }),
    ]);
  });

  it('marks the confirm button as loading while the request is in flight', async () => {
    let resolveFn!: (v: unknown) => void;
    const mx = createMockMatrixClient();
    (mx.redactEvent as any).mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveFn = resolve;
        })
    );
    const room = createMockRoom(ROOM_ID, mx);
    const mEvent = createMockMatrixEvent({ id: EVENT_ID });

    render(
      <MatrixTestWrapper matrixClient={mx}>
        <MessageDeleteItem room={room as any} mEvent={mEvent} />
      </MatrixTestWrapper>
    );

    fireEvent.click(screen.getByTestId('message-delete-btn'));
    fireEvent.submit(screen.getByTestId('message-delete-dialog'));

    await waitFor(() => {
      expect(screen.getByTestId('message-delete-confirm')).toHaveAttribute('data-loading');
    });

    resolveFn({ event_id: '$redacted' });

    await waitFor(() => {
      expect(screen.getByTestId('message-delete-confirm')).not.toHaveAttribute('data-loading');
    });
  });
});

describe('message editing (MessageEditor)', () => {
  async function renderEditor(onCancel = vi.fn()) {
    const mx = createMockMatrixClient();
    const room = createMockRoom(ROOM_ID, mx);
    const mEvent = createMockMatrixEvent({
      id: EVENT_ID,
      content: { body: 'original text', msgtype: MsgType.Text },
    });

    render(
      <MatrixTestWrapper matrixClient={mx}>
        <MessageEditor roomId={ROOM_ID} room={room as any} mEvent={mEvent} onCancel={onCancel} />
      </MatrixTestWrapper>
    );

    // Drain Slate's async state updates (queueMicrotask calls from insertFragment/Transforms.select
    // in the useEffect) so they don't leak outside act() into subsequent tests.
    await act(async () => {});

    return { mx, onCancel };
  }

  it('renders Save and Cancel buttons', async () => {
    await renderEditor();
    expect(screen.getByTestId('message-editor-save')).toBeInTheDocument();
    expect(screen.getByTestId('message-editor-cancel')).toBeInTheDocument();
  });

  it('calls onCancel when the Cancel button is clicked', async () => {
    const onCancel = vi.fn();
    await renderEditor(onCancel);

    fireEvent.click(screen.getByTestId('message-editor-cancel'));

    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it('closes the editor after a successful save', async () => {
    // MessageEditor calls onCancel() when saveState transitions to AsyncStatus.Success.
    // Clicking Save with unchanged (or empty) content returns undefined from the async
    // callback, which resolves the promise and triggers Success without a network call.
    const { onCancel } = await renderEditor();

    await act(async () => {
      fireEvent.click(screen.getByTestId('message-editor-save'));
    });

    expect(onCancel).toHaveBeenCalledTimes(1);
  });
});

describe('emoji reactions (Reactions)', () => {
  const REACTION_BTN_SELECTOR = '[data-reaction-key]';

  function renderReactions(
    opts: {
      canSendReaction?: boolean;
      includeMyReaction?: boolean;
    } = {}
  ) {
    const mx = createMockMatrixClient();
    const room = createMockRoom(ROOM_ID, mx);

    const aliceReaction = createMockReactionEvent('@alice:example.com', THUMBS_UP, EVENT_ID);
    const reactionEvents: MatrixEvent[] = [aliceReaction];

    if (opts.includeMyReaction) {
      // @me:example.com matches the userId returned by createMockMatrixClient
      reactionEvents.push(createMockReactionEvent('@me:example.com', THUMBS_UP, EVENT_ID));
    }

    // Reactions reads getLiveTimeline().getEvents() to build firstReactionTimestamps.
    // COUPLING: if Reactions ever switches to a different room API for timestamp data,
    // this mock setup will silently stop feeding the right events (update it then).
    const timeline = (room as any).getLiveTimeline();
    timeline.getEvents.mockReturnValue(reactionEvents);

    const relations = createMockRelations(reactionEvents);
    const mEvent = { on: vi.fn(), removeListener: vi.fn() };
    const timelineSet = { relations: { getChildEventsForEvent: () => relations } };
    const onReactionToggle = vi.fn();

    const { container } = render(
      <MatrixTestWrapper matrixClient={mx}>
        <Reactions
          room={room as any}
          mEvent={mEvent as any}
          timelineSet={timelineSet as any}
          mEventId={EVENT_ID}
          canSendReaction={opts.canSendReaction ?? true}
          onReactionToggle={onReactionToggle}
        />
      </MatrixTestWrapper>
    );

    return { container, onReactionToggle };
  }

  it('renders a reaction button for each unique emoji', () => {
    const { container } = renderReactions();
    expect(container.querySelector(REACTION_BTN_SELECTOR)).toBeInTheDocument();
  });

  it('shows the correct reaction count on the button', () => {
    const { container } = renderReactions();
    expect(container.querySelector(REACTION_BTN_SELECTOR)).toHaveTextContent('1');
  });

  it('calls onReactionToggle with the target event ID and emoji key when clicked', () => {
    const { container, onReactionToggle } = renderReactions();

    fireEvent.click(container.querySelector(REACTION_BTN_SELECTOR)!);

    expect(onReactionToggle).toHaveBeenCalledWith(EVENT_ID, THUMBS_UP);
  });

  it('does not call onReactionToggle when canSendReaction is false', () => {
    const { container, onReactionToggle } = renderReactions({ canSendReaction: false });

    fireEvent.click(container.querySelector(REACTION_BTN_SELECTOR)!);

    expect(onReactionToggle).not.toHaveBeenCalled();
  });

  it("marks the user's own reaction with aria-pressed=true", () => {
    const { container } = renderReactions({ includeMyReaction: true });
    expect(container.querySelector(REACTION_BTN_SELECTOR)).toHaveAttribute('aria-pressed', 'true');
  });

  it('marks a reaction not from the current user with aria-pressed=false', () => {
    const { container } = renderReactions({ includeMyReaction: false });
    expect(container.querySelector(REACTION_BTN_SELECTOR)).toHaveAttribute('aria-pressed', 'false');
  });
});
