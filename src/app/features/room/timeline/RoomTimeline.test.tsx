import { EventEmitter } from 'events';
import React, { useRef } from 'react';
import { render, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { EventTimeline, MatrixClient, MatrixEvent, Room } from 'matrix-js-sdk';
import { Direction, RoomEvent } from 'matrix-js-sdk';
import { Provider } from 'jotai';
import { MemoryRouter } from 'react-router-dom';
import { MatrixClientProvider } from '../../../hooks/useMatrixClient';
import { createMockMatrixClient, createMockMatrixEvent } from '../../../../test/mocks';
import {
  findObserverOf,
  installIntersectionObserverStub,
  installResizeObserverStub,
  stubScrollGeometry,
} from './timelineTestHelpers';
import type * as roomUtils from '../../../utils/room';
import { RoomTimeline } from './RoomTimeline';

const decryption = vi.hoisted(() => {
  let releaseDecryption: (() => void) | undefined;
  return {
    hold: () =>
      new Promise<void>((resolve) => {
        releaseDecryption = resolve;
      }),
    release: () => releaseDecryption?.(),
  };
});

vi.mock('../../../utils/room', async (importOriginal) => ({
  ...(await importOriginal<typeof roomUtils>()),
  decryptAllTimelineEvent: () => decryption.hold(),
}));

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

type LiveRoomFixture = RoomFixture & {
  prependEvents: (count: number) => void;
  arriveLiveEvents: (count: number) => void;
};

const createRoomWithPaginatableLiveTimeline = (encrypted: boolean): LiveRoomFixture => {
  const mx = createMockMatrixClient() as unknown as MatrixClient;
  const emitter = new EventEmitter();
  const events = ['$old0', '$old1', '$old2', '$old3', '$old4'].map((id) =>
    createMockMatrixEvent({ id, sender: OTHER_USER_ID })
  );

  const timelineSet = {
    relations: { getChildEventsForEvent: () => null },
    findEventById: () => undefined,
    getTimelineForEvent: () => null,
  } as unknown as FakeTimelineSet;

  const liveTimeline = {
    getEvents: () => events,
    getPaginationToken: (direction: Direction) =>
      direction === Direction.Backward ? 'back-token' : null,
    getNeighbouringTimeline: () => null,
    getTimelineSet: () => timelineSet,
    getRoomId: () => ROOM_ID,
  } as unknown as EventTimeline;

  timelineSet.getLiveTimeline = () => liveTimeline;

  const room = {
    roomId: ROOM_ID,
    client: mx,
    getLiveTimeline: () => liveTimeline,
    getUnfilteredTimelineSet: () => timelineSet,
    getEventReadUpTo: () => undefined,
    getReadReceiptForUserId: () => null,
    hasEncryptionStateEvent: () => encrypted,
    findEventById: () => undefined,
    getMember: () => null,
    on: (event: string, listener: (...args: unknown[]) => void) => {
      emitter.on(event, listener);
      return room;
    },
    off: (event: string, listener: (...args: unknown[]) => void) => {
      emitter.off(event, listener);
      return room;
    },
    removeListener: (event: string, listener: (...args: unknown[]) => void) => {
      emitter.removeListener(event, listener);
      return room;
    },
  } as unknown as Room;

  vi.mocked(mx.getRoom).mockReturnValue(room);

  let arrivedCount = 0;
  let prependedCount = 0;

  return {
    room,
    mx,
    detachedTimeline: liveTimeline,
    prependEvents: (count) => {
      const prepended = Array.from({ length: count }, (_unused, index) =>
        createMockMatrixEvent({
          id: `$back${prependedCount + index + 1}`,
          sender: OTHER_USER_ID,
        })
      );
      prependedCount += count;
      events.unshift(...prepended);
    },
    arriveLiveEvents: (count) => {
      Array.from({ length: count }).forEach((_unused, index) => {
        const arrived = createMockMatrixEvent({
          id: `$live${arrivedCount + index + 1}`,
          sender: OTHER_USER_ID,
        });
        events.push(arrived);
        emitter.emit(RoomEvent.Timeline, arrived, room, false, false, { liveEvent: true });
      });
      arrivedCount += count;
    },
  };
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

const reportLatestMessageVisible = (container: HTMLElement) => {
  const anchor = container.querySelector('[data-testid="latest-message-bottom"]') as HTMLElement;
  const observer = findObserverOf(anchor);
  act(() => {
    observer?.trigger(true);
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

const renderedEventIds = (container: HTMLElement): string[] =>
  Array.from(container.querySelectorAll('[data-testid="timeline-event"]')).map(
    (element) => element.getAttribute('data-message-id') as string
  );

const LATEST_MESSAGE_BOTTOM_SCROLL_TOP = 1600;
const HISTORY_SCROLL_TOP = 1000;

const stubTimelineGeometry = (container: HTMLElement) => {
  const scrollElement = container.querySelector('[data-testid="timeline-scroll"]') as HTMLElement;
  const anchorElement = container.querySelector(
    '[data-testid="latest-message-bottom"]'
  ) as HTMLElement;
  const geometry = stubScrollGeometry(scrollElement, {
    scrollHeight: 2000,
    offsetHeight: 400,
    anchorElement,
  });
  return (scrollTop: number) => {
    geometry.setScrollTop(scrollTop);
    act(() => {
      findObserverOf(anchorElement)?.trigger(scrollTop >= LATEST_MESSAGE_BOTTOM_SCROLL_TOP);
      scrollElement.dispatchEvent(new Event('scroll'));
    });
  };
};

const scrollToLatestMessage = (container: HTMLElement) => {
  stubTimelineGeometry(container)(LATEST_MESSAGE_BOTTOM_SCROLL_TOP);
};

const scrollAwayFromLatestMessage = (container: HTMLElement) => {
  const scrollTo = stubTimelineGeometry(container);
  scrollTo(LATEST_MESSAGE_BOTTOM_SCROLL_TOP);
  scrollTo(HISTORY_SCROLL_TOP);
};

const triggerBackPagination = async (container: HTMLElement) => {
  const backAnchor = container.querySelector('[data-paginator-anchor="B"]') as HTMLElement;
  const observer = findObserverOf(backAnchor);
  await act(async () => {
    observer?.trigger(true);
  });
};

describe('RoomTimeline window stability during back pagination', () => {
  it('renders an arriving live event while following the newest message', async () => {
    const fixture = createRoomWithPaginatableLiveTimeline(false);
    const { container } = renderTimeline(fixture);
    scrollToLatestMessage(container);

    await act(async () => {
      fixture.arriveLiveEvents(1);
    });

    expect(renderedEventIds(container)).toContain('$live1');
  });

  it('renders the same events when live events arrive during the pagination request', async () => {
    const fixture = createRoomWithPaginatableLiveTimeline(false);
    const { container } = renderTimeline(fixture);
    scrollAwayFromLatestMessage(container);
    const eventIdsBeforePagination = renderedEventIds(container);

    fixture.mx.paginateEventTimeline = vi.fn(async () => {
      fixture.prependEvents(3);
      fixture.arriveLiveEvents(2);
      return true;
    }) as MatrixClient['paginateEventTimeline'];

    await triggerBackPagination(container);

    expect(renderedEventIds(container)).toEqual(eventIdsBeforePagination);
  });

  it('renders the same events when a live event arrives while the fetched page is decrypting', async () => {
    const fixture = createRoomWithPaginatableLiveTimeline(true);
    const { container } = renderTimeline(fixture);
    scrollAwayFromLatestMessage(container);
    const eventIdsBeforePagination = renderedEventIds(container);

    fixture.mx.paginateEventTimeline = vi.fn(async () => {
      fixture.prependEvents(3);
      return true;
    }) as MatrixClient['paginateEventTimeline'];

    await triggerBackPagination(container);
    await act(async () => {
      fixture.arriveLiveEvents(1);
    });

    expect(renderedEventIds(container)).toEqual(eventIdsBeforePagination);

    await act(async () => {
      decryption.release();
    });

    expect(renderedEventIds(container)).toEqual(eventIdsBeforePagination);
  });
});

describe('RoomTimeline auto mark as read', () => {
  it('sends a read receipt at the newest message when the stored receipt sits in a detached timeline', () => {
    const fixture = createRoomWithDetachedReceipt();
    const { container } = renderTimeline(fixture);

    reportLatestMessageVisible(container);

    expect(vi.mocked(fixture.mx.sendReadReceipt)).toHaveBeenCalled();
  });

  it('does not send a read receipt at the bottom of a window opened away from the newest event', async () => {
    const fixture = createRoomWithDetachedReceipt();
    const { container } = renderTimeline(fixture, RECEIPT_EVENT_ID);
    await act(async () => {
      await Promise.resolve();
    });

    reportLatestMessageVisible(container);

    expect(vi.mocked(fixture.mx.sendReadReceipt)).not.toHaveBeenCalled();
  });
});
