import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { MatrixEvent, Room } from 'matrix-js-sdk';
import { RoomStateEvent } from 'matrix-js-sdk';
import { EventEmitter } from 'events';
import { createMockMatrixEvent, createMockRoom } from '../../test/mocks';
import { StateEvent } from '../../types/matrix/room';
import { useStateEvents } from './useStateEvents';
import { getStateEvents } from '../utils/room';

vi.mock('../utils/room', () => ({
  getStateEvents: vi.fn(),
}));

const mockGetStateEvents = vi.mocked(getStateEvents);

function makeEmittingClient() {
  const emitter = new EventEmitter();
  return {
    on: emitter.on.bind(emitter),
    off: emitter.off.bind(emitter),
    removeListener: emitter.removeListener.bind(emitter),
    emit: emitter.emit.bind(emitter),
  };
}

function makeRoom(roomId: string, client: ReturnType<typeof makeEmittingClient>) {
  const room = createMockRoom(roomId);
  (room as Record<string, unknown>).client = client;
  return room as unknown as Room;
}

describe('useStateEvents', () => {
  let client: ReturnType<typeof makeEmittingClient>;
  let room: Room;

  beforeEach(() => {
    vi.clearAllMocks();
    client = makeEmittingClient();
    room = makeRoom('!room:example.com', client);
  });

  it('returns the initial state events', () => {
    const events = [
      createMockMatrixEvent({ type: StateEvent.RoomMember, stateKey: '@alice:example.com' }),
      createMockMatrixEvent({ type: StateEvent.RoomMember, stateKey: '@bob:example.com' }),
    ];
    mockGetStateEvents.mockReturnValue(events);

    const { result } = renderHook(() => useStateEvents(room, StateEvent.RoomMember));

    expect(result.current).toBe(events);
    expect(mockGetStateEvents).toHaveBeenCalledWith(room, StateEvent.RoomMember);
  });

  it('returns empty array when no state events exist', () => {
    const empty: MatrixEvent[] = [];
    mockGetStateEvents.mockReturnValue(empty);

    const { result } = renderHook(() => useStateEvents(room, StateEvent.RoomMember));

    expect(result.current).toBe(empty);
  });

  it('re-renders when a matching state event is emitted', () => {
    const initial = [
      createMockMatrixEvent({ type: StateEvent.RoomMember, stateKey: '@alice:example.com' }),
    ];
    mockGetStateEvents.mockReturnValue(initial);

    const { result } = renderHook(() => useStateEvents(room, StateEvent.RoomMember));
    expect(result.current).toBe(initial);

    const updated = [
      createMockMatrixEvent({ type: StateEvent.RoomMember, stateKey: '@alice:example.com' }),
      createMockMatrixEvent({ type: StateEvent.RoomMember, stateKey: '@bob:example.com' }),
    ];
    mockGetStateEvents.mockReturnValue(updated);

    const emitted = createMockMatrixEvent({
      type: StateEvent.RoomMember,
      stateKey: '@bob:example.com',
      roomId: '!room:example.com',
    });

    act(() => {
      client.emit(RoomStateEvent.Events, emitted, {}, null);
    });

    expect(result.current).toBe(updated);
  });

  it('reads new state when room prop changes', () => {
    const eventsA = [
      createMockMatrixEvent({ type: StateEvent.RoomMember, stateKey: '@alice:example.com' }),
    ];
    const eventsB = [
      createMockMatrixEvent({ type: StateEvent.RoomMember, stateKey: '@carol:example.com' }),
    ];

    const client2 = makeEmittingClient();
    const roomB = makeRoom('!other:example.com', client2);

    mockGetStateEvents.mockImplementation((r: Room) =>
      r.roomId === '!room:example.com' ? eventsA : eventsB
    );

    const { result, rerender } = renderHook(
      ({ r }: { r: Room }) => useStateEvents(r, StateEvent.RoomMember),
      { initialProps: { r: room } }
    );

    expect(result.current).toBe(eventsA);

    rerender({ r: roomB });

    expect(result.current).toBe(eventsB);
  });
});
