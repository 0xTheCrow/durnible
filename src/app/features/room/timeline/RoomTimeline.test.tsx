import React, { useRef } from 'react';
import { render, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { EventTimeline, MatrixClient, MatrixEvent, Room } from 'matrix-js-sdk';
import { Provider } from 'jotai';
import { MemoryRouter } from 'react-router-dom';
import { MatrixClientProvider } from '../../../hooks/useMatrixClient';
import { createMockMatrixClient, createMockMatrixEvent } from '../../../../test/mocks';
import {
  installIntersectionObserverStub,
  installResizeObserverStub,
  ioInstances,
} from './timelineTestHelpers';
import { RoomTimeline } from './RoomTimeline';

vi.mock('./MemoizedTimelineEvent', () => ({
  MemoizedTimelineEvent: ({ mEventId }: { mEventId: string }) => (
    <div data-message-id={mEventId} data-testid="timeline-event" />
  ),
}));

vi.mock('./hooks/useTimelineMessageContextValue', () => ({
  useTimelineMessageContextValue: () => ({}),
}));

vi.mock('../../../hooks/useRoomNavigate', () => ({
  useRoomNavigate: () => ({ navigateRoom: vi.fn() }),
}));

vi.mock('../../../hooks/useIgnoredUsers', () => ({
  useIgnoredUsers: () => [],
}));

vi.mock('../../../components/room-intro', () => ({
  RoomIntro: () => null,
}));

const ROOM_ID = '!room:example.com';
const RECEIPT_EVENT_ID = '$receipt';
const OTHER_USER_ID = '@them:example.com';

type FakeTimelineSet = {
  getLiveTimeline: () => EventTimeline;
  getTimelineForEvent: (eventId: string) => EventTimeline | null;
  findEventById: () => undefined;
  relations: { getChildEventsForEvent: () => null };
};

const createFakeTimeline = (events: MatrixEvent[], timelineSet: FakeTimelineSet): EventTimeline =>
  ({
    getEvents: () => events,
    getPaginationToken: () => null,
    getNeighbouringTimeline: () => null,
    getTimelineSet: () => timelineSet,
  } as unknown as EventTimeline);

type RoomFixture = {
  room: Room;
  mx: MatrixClient;
  detachedTimeline: EventTimeline;
};

/**
 * Builds a room whose stored read receipt sits in a timeline that is not linked
 * to the live timeline — the shape `loadEventContext` produces when a room is
 * opened with a backlog larger than the loaded live window.
 */
const createRoomWithDetachedReceipt = (): RoomFixture => {
  const mx = createMockMatrixClient() as unknown as MatrixClient;

  const timelineSet = {
    relations: { getChildEventsForEvent: () => null },
    findEventById: () => undefined,
  } as unknown as FakeTimelineSet;

  const detachedTimeline = createFakeTimeline(
    [createMockMatrixEvent({ id: RECEIPT_EVENT_ID, sender: OTHER_USER_ID })],
    timelineSet
  );
  const liveTimeline = createFakeTimeline(
    [
      createMockMatrixEvent({ id: '$live1', sender: OTHER_USER_ID }),
      createMockMatrixEvent({ id: '$live2', sender: OTHER_USER_ID }),
    ],
    timelineSet
  );

  timelineSet.getLiveTimeline = () => liveTimeline;
  timelineSet.getTimelineForEvent = (eventId: string) =>
    eventId === RECEIPT_EVENT_ID ? detachedTimeline : null;

  const room = {
    roomId: ROOM_ID,
    client: mx,
    getLiveTimeline: () => liveTimeline,
    getUnfilteredTimelineSet: () => timelineSet,
    getEventReadUpTo: () => RECEIPT_EVENT_ID,
    getReadReceiptForUserId: (_userId: string, _ignoreSynthetic: boolean, receiptType: string) =>
      receiptType === 'm.read' ? { eventId: RECEIPT_EVENT_ID, data: { ts: 1 } } : null,
    hasEncryptionStateEvent: () => false,
    findEventById: () => undefined,
    getMember: () => null,
    on: vi.fn().mockReturnThis(),
    off: vi.fn().mockReturnThis(),
    removeListener: vi.fn().mockReturnThis(),
  } as unknown as Room;

  vi.mocked(mx.getRoom).mockReturnValue(room);
  mx.getEventTimeline = vi.fn(async () => detachedTimeline) as MatrixClient['getEventTimeline'];

  return { room, mx, detachedTimeline };
};

function Harness({ room, eventId }: { room: Room; eventId?: string }) {
  const roomInputRef = useRef<HTMLElement>(null);
  const editorInputRef = useRef(null);
  return (
    <RoomTimeline
      room={room}
      eventId={eventId}
      roomInputRef={roomInputRef}
      editorInputRef={editorInputRef}
    />
  );
}

const renderTimeline = ({ room, mx }: RoomFixture, eventId?: string) =>
  render(
    <MemoryRouter>
      <Provider>
        <MatrixClientProvider value={mx}>
          <Harness room={room} eventId={eventId} />
        </MatrixClientProvider>
      </Provider>
    </MemoryRouter>
  );

const reachLiveEdge = () => {
  act(() => {
    ioInstances.forEach((observer) => observer.trigger(true));
  });
};

beforeEach(() => {
  installIntersectionObserverStub();
  installResizeObserverStub();
  vi.spyOn(document, 'hasFocus').mockReturnValue(true);
});

afterEach(() => {
  vi.clearAllMocks();
  vi.restoreAllMocks();
});

describe('RoomTimeline auto mark as read', () => {
  it('sends a read receipt at the live edge when the stored receipt sits in a detached timeline', () => {
    const fixture = createRoomWithDetachedReceipt();
    renderTimeline(fixture);

    reachLiveEdge();

    expect(vi.mocked(fixture.mx.sendReadReceipt)).toHaveBeenCalled();
  });

  it('does not send a read receipt at the bottom of a window opened away from the live edge', async () => {
    const fixture = createRoomWithDetachedReceipt();
    renderTimeline(fixture, RECEIPT_EVENT_ID);
    await act(async () => {
      await Promise.resolve();
    });

    reachLiveEdge();

    expect(vi.mocked(fixture.mx.sendReadReceipt)).not.toHaveBeenCalled();
  });
});
