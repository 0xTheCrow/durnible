import { renderHook, act, waitFor } from '@testing-library/react';
import React, { ReactNode } from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MatrixEvent, MatrixEventEvent, Room } from 'matrix-js-sdk';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { EventEmitter } from 'events';
import { useRoomEvent } from './useRoomEvent';
import { MatrixClientProvider } from './useMatrixClient';
import { createMockMatrixClient, createMockRoom } from '../../test/mocks';

/**
 * Creates a mock MatrixEvent that supports event emission,
 * so tests can simulate Replaced / Decrypted signals.
 */
function createEmittingEvent(opts: {
  id?: string;
  sender?: string;
  content?: Record<string, unknown>;
  originalContent?: Record<string, unknown>;
  replacingEvent?: MatrixEvent | null;
  encrypted?: boolean;
}): MatrixEvent {
  const emitter = new EventEmitter();
  const id = opts.id ?? '$evt';
  const content = opts.content ?? { body: 'hello', msgtype: 'm.text' };
  const originalContent = opts.originalContent ?? content;
  let replacing = opts.replacingEvent ?? null;

  const event = {
    getId: vi.fn(() => id),
    getSender: vi.fn(() => opts.sender ?? '@alice:example.com'),
    getType: vi.fn(() => 'm.room.message'),
    getContent: vi.fn(() => {
      if (replacing) {
        return replacing.getContent()['m.new_content'] ?? {};
      }
      return content;
    }),
    getOriginalContent: vi.fn(() => originalContent),
    isRedacted: vi.fn(() => false),
    isEncrypted: vi.fn(() => opts.encrypted ?? false),
    replacingEvent: vi.fn(() => replacing),
    makeReplaced: vi.fn((newEvent?: MatrixEvent) => {
      replacing = newEvent ?? null;
      emitter.emit(MatrixEventEvent.Replaced, event);
    }),
    on: vi.fn((evt: string, handler: (...args: unknown[]) => void) => {
      emitter.on(evt, handler);
      return event;
    }),
    off: vi.fn((evt: string, handler: (...args: unknown[]) => void) => {
      emitter.off(evt, handler);
      return event;
    }),
    removeListener: vi.fn((evt: string, handler: (...args: unknown[]) => void) => {
      emitter.removeListener(evt, handler);
      return event;
    }),
    // Allow tests to emit events directly
    _emit: (evt: string, ...args: unknown[]) => emitter.emit(evt, ...args),
  };

  return event as unknown as MatrixEvent;
}

function createWrapper(mx: Partial<ReturnType<typeof createMockMatrixClient>>) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });

  return function Wrapper({ children }: { children: ReactNode }) {
    return React.createElement(
      QueryClientProvider,
      { client: queryClient },
      React.createElement(
        MatrixClientProvider,
        { value: mx as any },
        children
      )
    );
  };
}

describe('useRoomEvent', () => {
  let mx: ReturnType<typeof createMockMatrixClient>;
  let room: ReturnType<typeof createMockRoom>;

  beforeEach(() => {
    mx = createMockMatrixClient();
    room = createMockRoom('!room:example.com', mx);
  });

  it('returns a locally found event', () => {
    const event = createEmittingEvent({ id: '$local' });
    const getLocally = vi.fn(() => event);

    const { result } = renderHook(
      () => useRoomEvent(room as unknown as Room, '$local', getLocally),
      { wrapper: createWrapper(mx) }
    );

    expect(result.current).toBe(event);
  });

  it('re-renders when the event emits Replaced', async () => {
    const editEvent = createEmittingEvent({
      id: '$edit',
      content: {
        'm.new_content': { body: 'edited', msgtype: 'm.text' },
        'body': '* edited',
        'msgtype': 'm.text',
      },
    });

    // Start with content that has no body (simulating unresolved edit)
    const event = createEmittingEvent({
      id: '$original',
      content: { body: 'original', msgtype: 'm.text' },
    });
    const getLocally = vi.fn(() => event);

    const { result } = renderHook(
      () => useRoomEvent(room as unknown as Room, '$original', getLocally),
      { wrapper: createWrapper(mx) }
    );

    expect(result.current?.getContent()).toEqual({ body: 'original', msgtype: 'm.text' });

    // Simulate an edit arriving — makeReplaced emits Replaced
    act(() => {
      event.makeReplaced(editEvent);
    });

    await waitFor(() => {
      expect(result.current?.getContent()).toEqual({ body: 'edited', msgtype: 'm.text' });
    });
  });

  it('re-renders when the event emits Decrypted', async () => {
    const event = createEmittingEvent({
      id: '$enc',
      content: {},
      encrypted: true,
    });
    const getLocally = vi.fn(() => event);

    const { result } = renderHook(
      () => useRoomEvent(room as unknown as Room, '$enc', getLocally),
      { wrapper: createWrapper(mx) }
    );

    // Initially empty content (not yet decrypted)
    expect(result.current?.getContent()).toEqual({});

    // Simulate decryption completing — swap content and emit
    const decryptedContent = { body: 'secret', msgtype: 'm.text' };
    (event.getContent as ReturnType<typeof vi.fn>).mockReturnValue(decryptedContent);

    act(() => {
      (event as any)._emit(MatrixEventEvent.Decrypted, event);
    });

    await waitFor(() => {
      expect(result.current?.getContent()).toEqual(decryptedContent);
    });
  });

  it('re-renders when the replacing event emits Decrypted', async () => {
    // Replacing event starts encrypted — m.new_content not available
    const replacingEvt = createEmittingEvent({
      id: '$edit',
      content: {},
      encrypted: true,
    });

    // Original event has the encrypted replacing event, so getContent() returns {}
    const event = createEmittingEvent({
      id: '$original',
      content: { body: 'original', msgtype: 'm.text' },
      replacingEvent: replacingEvt,
    });
    const getLocally = vi.fn(() => event);

    const { result } = renderHook(
      () => useRoomEvent(room as unknown as Room, '$original', getLocally),
      { wrapper: createWrapper(mx) }
    );

    // getContent() follows the replacing event, which returns {} (no m.new_content yet)
    expect(result.current?.getContent()).toEqual({});

    // Simulate the replacing event finishing decryption
    const decryptedEditContent = {
      'm.new_content': { body: 'edited secret', msgtype: 'm.text' },
      'body': '* edited secret',
      'msgtype': 'm.text',
    };
    (replacingEvt.getContent as ReturnType<typeof vi.fn>).mockReturnValue(decryptedEditContent);

    act(() => {
      (replacingEvt as any)._emit(MatrixEventEvent.Decrypted, replacingEvt);
    });

    await waitFor(() => {
      expect(result.current?.getContent()).toEqual({ body: 'edited secret', msgtype: 'm.text' });
    });
  });

  it('fetches and decrypts the replacing event when not found locally', async () => {
    const crypto = {} as any;
    (mx as any).getCrypto = vi.fn(() => crypto);
    (mx as any).fetchRoomEvent = vi.fn(async () => ({
      event_id: '$fetched',
      type: 'm.room.message',
      sender: '@alice:example.com',
      content: {
        algorithm: 'm.megolm.v1.aes-sha2',
        ciphertext: 'encrypted',
      },
      origin_server_ts: Date.now(),
      unsigned: {
        'm.relations': {
          'm.replace': {
            event_id: '$edit',
            type: 'm.room.message',
            sender: '@alice:example.com',
            content: {
              algorithm: 'm.megolm.v1.aes-sha2',
              ciphertext: 'encrypted-edit',
            },
            origin_server_ts: Date.now(),
          },
        },
      },
    }));

    const { result } = renderHook(
      () => useRoomEvent(room as unknown as Room, '$fetched'),
      { wrapper: createWrapper(mx) }
    );

    await waitFor(() => {
      expect(result.current).not.toBeUndefined();
    });

    // Verify fetchRoomEvent was called
    expect((mx as any).fetchRoomEvent).toHaveBeenCalledWith('!room:example.com', '$fetched');
  });
});
