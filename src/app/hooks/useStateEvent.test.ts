import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Room } from 'matrix-js-sdk';
import { RoomStateEvent } from 'matrix-js-sdk';
import { EventEmitter } from 'events';
import { createMockMatrixEvent, createMockRoom } from '../../test/mocks';
import { StateEvent } from '../../types/matrix/room';
import { useStateEvent } from './useStateEvent';
import { getStateEvent } from '../utils/room';

vi.mock('../utils/room', () => ({
  getStateEvent: vi.fn(),
}));

const mockGetStateEvent = vi.mocked(getStateEvent);

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

describe('useStateEvent', () => {
  let client: ReturnType<typeof makeEmittingClient>;
  let room: Room;

  beforeEach(() => {
    vi.clearAllMocks();
    client = makeEmittingClient();
    room = makeRoom('!room:example.com', client);
  });

  it('returns the initial state event', () => {
    const event = createMockMatrixEvent({ type: StateEvent.RoomName, stateKey: '' });
    mockGetStateEvent.mockReturnValue(event);

    const { result } = renderHook(() => useStateEvent(room, StateEvent.RoomName));

    expect(result.current).toBe(event);
    expect(mockGetStateEvent).toHaveBeenCalledWith(room, StateEvent.RoomName, '');
  });

  it('returns undefined when no state event exists', () => {
    mockGetStateEvent.mockReturnValue(undefined);

    const { result } = renderHook(() => useStateEvent(room, StateEvent.RoomName));

    expect(result.current).toBeUndefined();
  });

  it('re-renders when a matching state event is emitted', () => {
    const initial = createMockMatrixEvent({ type: StateEvent.RoomName, stateKey: '' });
    mockGetStateEvent.mockReturnValue(initial);

    const { result } = renderHook(() => useStateEvent(room, StateEvent.RoomName));
    expect(result.current).toBe(initial);

    const updated = createMockMatrixEvent({ type: StateEvent.RoomName, stateKey: '' });
    mockGetStateEvent.mockReturnValue(updated);

    const emitted = createMockMatrixEvent({
      type: StateEvent.RoomName,
      stateKey: '',
      roomId: '!room:example.com',
    });

    act(() => {
      client.emit(RoomStateEvent.Events, emitted, {}, null);
    });

    expect(result.current).toBe(updated);
  });

  it('reads new state when room prop changes', () => {
    const eventA = createMockMatrixEvent({ type: StateEvent.RoomName, stateKey: '' });
    const eventB = createMockMatrixEvent({ type: StateEvent.RoomName, stateKey: '' });

    const client2 = makeEmittingClient();
    const roomB = makeRoom('!other:example.com', client2);

    mockGetStateEvent.mockImplementation((r: Room) =>
      r.roomId === '!room:example.com' ? eventA : eventB
    );

    const { result, rerender } = renderHook(
      ({ r }: { r: Room }) => useStateEvent(r, StateEvent.RoomName),
      { initialProps: { r: room } }
    );

    expect(result.current).toBe(eventA);

    rerender({ r: roomB });

    expect(result.current).toBe(eventB);
  });
});
