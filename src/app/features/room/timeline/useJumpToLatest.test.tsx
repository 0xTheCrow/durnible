import React from 'react';
import { render, act } from '@testing-library/react';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import type { MatrixEvent, Room } from 'matrix-js-sdk';
import { RelationType, RoomEvent } from 'matrix-js-sdk';
import type { UseJumpToLatest } from './useJumpToLatest';
import { useJumpToLatest } from './useJumpToLatest';
import {
  createEventEmitterRoom,
  createFakeEvent,
  findObserverOf,
  installIntersectionObserverStub,
  ioInstances,
  stubScrollGeometry,
} from './timelineTestHelpers';

type FakeResizeObserver = {
  callback: ResizeObserverCallback;
  observed: Set<Element>;
  observe: (target: Element) => void;
  unobserve: (target: Element) => void;
  disconnect: () => void;
  trigger: () => void;
};

const roInstances: FakeResizeObserver[] = [];

function installResizeObserverStub(): void {
  roInstances.length = 0;
  const ctor = function StubResizeObserver(this: ResizeObserver, cb: ResizeObserverCallback) {
    const instance: FakeResizeObserver = {
      callback: cb,
      observed: new Set(),
      observe(target) {
        instance.observed.add(target);
      },
      unobserve(target) {
        instance.observed.delete(target);
      },
      disconnect() {
        instance.observed.clear();
      },
      trigger() {
        const entries: ResizeObserverEntry[] = Array.from(instance.observed).map(
          (target) =>
            ({
              target,
              contentRect: { width: 0, height: 0, top: 0, left: 0, right: 0, bottom: 0 },
            } as unknown as ResizeObserverEntry)
        );
        instance.callback(entries, instance as unknown as ResizeObserver);
      },
    };
    roInstances.push(instance);
    return instance as unknown as ResizeObserver;
  } as unknown as typeof ResizeObserver;
  (globalThis as unknown as { ResizeObserver: typeof ResizeObserver }).ResizeObserver = ctor;
}

function createRelationEvent(type: string, relType: string): MatrixEvent {
  const id = `$${Math.random().toString(36).slice(2)}`;
  return {
    getId: () => id,
    getType: () => type,
    getContent: () => ({}),
    getRoomId: () => '!test:example.com',
    getSender: () => '@alice:example.com',
    isRedacted: () => false,
    getRelation: () => ({ rel_type: relType }),
  } as unknown as MatrixEvent;
}

const LAST_INDEX = 2;

type HarnessProps = {
  room: Room;
  viewingLatest?: boolean;
  lastMessageIndex?: number | null;
  autoPinEnabled?: boolean;
  initiallyAtBottom?: boolean;
  onHook?: (hook: UseJumpToLatest) => void;
};

function Harness({
  room,
  viewingLatest = true,
  lastMessageIndex = LAST_INDEX,
  autoPinEnabled = true,
  initiallyAtBottom = true,
  onHook,
}: HarnessProps) {
  const hook = useJumpToLatest({
    room,
    viewingLatest,
    lastMessageIndex,
    autoPinEnabled,
    initiallyAtBottom,
  });
  onHook?.(hook);
  return (
    <div ref={hook.scrollRef} data-testid="scroll">
      <div ref={hook.contentRef} data-testid="content">
        <div data-message-item={0}>msg 0</div>
        <div data-message-item={1}>msg 1</div>
        <div data-message-item={LAST_INDEX} data-testid="last-msg">
          msg {LAST_INDEX}
        </div>
      </div>
    </div>
  );
}

let originalIO: typeof IntersectionObserver | undefined;
let originalRO: typeof ResizeObserver | undefined;

describe('useJumpToLatest', () => {
  beforeEach(() => {
    originalIO = (globalThis as unknown as { IntersectionObserver: typeof IntersectionObserver })
      .IntersectionObserver;
    originalRO = (globalThis as unknown as { ResizeObserver: typeof ResizeObserver })
      .ResizeObserver;
    installIntersectionObserverStub();
    installResizeObserverStub();
  });

  afterEach(() => {
    if (originalIO) {
      (
        globalThis as unknown as { IntersectionObserver: typeof IntersectionObserver }
      ).IntersectionObserver = originalIO;
    }
    if (originalRO) {
      (globalThis as unknown as { ResizeObserver: typeof ResizeObserver }).ResizeObserver =
        originalRO;
    }
    ioInstances.length = 0;
    roInstances.length = 0;
  });

  it('reflects last-message intersection in isAtBottom (true)', () => {
    const room = createEventEmitterRoom('!test:example.com');
    const hookState: { current: UseJumpToLatest | null } = { current: null };
    const { container } = render(
      <Harness
        room={room}
        initiallyAtBottom={false}
        onHook={(h) => {
          hookState.current = h;
        }}
      />
    );
    const lastEl = container.querySelector('[data-testid="last-msg"]') as HTMLElement;
    act(() => {
      findObserverOf(lastEl)?.trigger(true);
    });
    expect(hookState.current!.isAtBottom).toBe(true);
    expect(hookState.current!.isAtBottomRef.current).toBe(true);
  });

  it('reflects last-message intersection in isAtBottom (false)', () => {
    const room = createEventEmitterRoom('!test:example.com');
    const hookState: { current: UseJumpToLatest | null } = { current: null };
    const { container } = render(
      <Harness
        room={room}
        onHook={(h) => {
          hookState.current = h;
        }}
      />
    );
    const lastEl = container.querySelector('[data-testid="last-msg"]') as HTMLElement;
    act(() => {
      findObserverOf(lastEl)?.trigger(false);
    });
    expect(hookState.current!.isAtBottom).toBe(false);
    expect(hookState.current!.isAtBottomRef.current).toBe(false);
  });

  it('setIsAtBottom updates ref and state synchronously', () => {
    const room = createEventEmitterRoom('!test:example.com');
    const hookState: { current: UseJumpToLatest | null } = { current: null };
    render(
      <Harness
        room={room}
        onHook={(h) => {
          hookState.current = h;
        }}
      />
    );
    expect(hookState.current!.isAtBottom).toBe(true);
    act(() => {
      hookState.current!.setIsAtBottom(false);
    });
    expect(hookState.current!.isAtBottom).toBe(false);
    expect(hookState.current!.isAtBottomRef.current).toBe(false);
  });

  it('requestScrollToBottom(true) performs a smooth scroll', () => {
    const room = createEventEmitterRoom('!test:example.com');
    const hookState: { current: UseJumpToLatest | null } = { current: null };
    const { container } = render(
      <Harness
        room={room}
        onHook={(h) => {
          hookState.current = h;
        }}
      />
    );
    const scrollEl = container.querySelector('[data-testid="scroll"]') as HTMLDivElement;
    const geom = stubScrollGeometry(scrollEl, { scrollHeight: 500, offsetHeight: 400 });
    act(() => {
      hookState.current!.requestScrollToBottom(true);
    });
    expect(geom.getLastScrollBehavior()).toBe('smooth');
  });

  it('requestScrollToBottom(false) performs an instant scroll', () => {
    const room = createEventEmitterRoom('!test:example.com');
    const hookState: { current: UseJumpToLatest | null } = { current: null };
    const { container } = render(
      <Harness
        room={room}
        onHook={(h) => {
          hookState.current = h;
        }}
      />
    );
    const scrollEl = container.querySelector('[data-testid="scroll"]') as HTMLDivElement;
    const geom = stubScrollGeometry(scrollEl, { scrollHeight: 500, offsetHeight: 400 });
    act(() => {
      hookState.current!.requestScrollToBottom(false);
    });
    expect(geom.getLastScrollBehavior()).toBe('instant');
  });

  it('auto-pins on a visible live message when at-bottom and viewing latest', () => {
    const room = createEventEmitterRoom('!test:example.com');
    const { container } = render(<Harness room={room} />);
    const scrollEl = container.querySelector('[data-testid="scroll"]') as HTMLDivElement;
    const lastEl = container.querySelector('[data-testid="last-msg"]') as HTMLElement;
    const geom = stubScrollGeometry(scrollEl, { scrollHeight: 500, offsetHeight: 400 });
    geom.setScrollTop(100);
    act(() => {
      findObserverOf(lastEl)?.trigger(true);
    });
    geom.setScrollHeight(540);
    act(() => {
      room.emit(RoomEvent.Timeline, createFakeEvent('m.room.message'), room, undefined, false, {
        liveEvent: true,
      });
    });
    expect(geom.getScrollTop()).toBe(540 - 400);
  });

  it('does not auto-pin for a reaction (invisible relation)', () => {
    const room = createEventEmitterRoom('!test:example.com');
    const { container } = render(<Harness room={room} />);
    const scrollEl = container.querySelector('[data-testid="scroll"]') as HTMLDivElement;
    const lastEl = container.querySelector('[data-testid="last-msg"]') as HTMLElement;
    const geom = stubScrollGeometry(scrollEl, { scrollHeight: 500, offsetHeight: 400 });
    geom.setScrollTop(100);
    act(() => {
      findObserverOf(lastEl)?.trigger(true);
    });
    act(() => {
      room.emit(
        RoomEvent.Timeline,
        createRelationEvent('m.reaction', RelationType.Annotation),
        room,
        undefined,
        false,
        { liveEvent: true }
      );
    });
    expect(geom.getScrollTop()).toBe(100);
  });

  it('does not auto-pin for an edit (invisible relation)', () => {
    const room = createEventEmitterRoom('!test:example.com');
    const { container } = render(<Harness room={room} />);
    const scrollEl = container.querySelector('[data-testid="scroll"]') as HTMLDivElement;
    const lastEl = container.querySelector('[data-testid="last-msg"]') as HTMLElement;
    const geom = stubScrollGeometry(scrollEl, { scrollHeight: 500, offsetHeight: 400 });
    geom.setScrollTop(100);
    act(() => {
      findObserverOf(lastEl)?.trigger(true);
    });
    act(() => {
      room.emit(
        RoomEvent.Timeline,
        createRelationEvent('m.room.message', RelationType.Replace),
        room,
        undefined,
        false,
        { liveEvent: true }
      );
    });
    expect(geom.getScrollTop()).toBe(100);
  });

  it('does not auto-pin for a redaction event', () => {
    const room = createEventEmitterRoom('!test:example.com');
    const { container } = render(<Harness room={room} />);
    const scrollEl = container.querySelector('[data-testid="scroll"]') as HTMLDivElement;
    const lastEl = container.querySelector('[data-testid="last-msg"]') as HTMLElement;
    const geom = stubScrollGeometry(scrollEl, { scrollHeight: 500, offsetHeight: 400 });
    geom.setScrollTop(100);
    act(() => {
      findObserverOf(lastEl)?.trigger(true);
    });
    const redaction = {
      ...createFakeEvent('m.room.redaction'),
      isRedaction: () => true,
    } as unknown as MatrixEvent;
    act(() => {
      room.emit(RoomEvent.Timeline, redaction, room, undefined, false, { liveEvent: true });
    });
    expect(geom.getScrollTop()).toBe(100);
  });

  it('does not auto-pin when not at bottom', () => {
    const room = createEventEmitterRoom('!test:example.com');
    const { container } = render(<Harness room={room} />);
    const scrollEl = container.querySelector('[data-testid="scroll"]') as HTMLDivElement;
    const lastEl = container.querySelector('[data-testid="last-msg"]') as HTMLElement;
    const geom = stubScrollGeometry(scrollEl, { scrollHeight: 1000, offsetHeight: 400 });
    geom.setScrollTop(200);
    act(() => {
      findObserverOf(lastEl)?.trigger(false);
    });
    act(() => {
      room.emit(RoomEvent.Timeline, createFakeEvent('m.room.message'), room, undefined, false, {
        liveEvent: true,
      });
    });
    expect(geom.getScrollTop()).toBe(200);
  });

  it('does not auto-pin when viewingLatest is false', () => {
    const room = createEventEmitterRoom('!test:example.com');
    const { container } = render(<Harness room={room} viewingLatest={false} />);
    const scrollEl = container.querySelector('[data-testid="scroll"]') as HTMLDivElement;
    const geom = stubScrollGeometry(scrollEl, { scrollHeight: 500, offsetHeight: 400 });
    geom.setScrollTop(100);
    act(() => {
      room.emit(RoomEvent.Timeline, createFakeEvent('m.room.message'), room, undefined, false, {
        liveEvent: true,
      });
    });
    expect(geom.getScrollTop()).toBe(100);
  });

  it('does not auto-pin when autoPinEnabled is false', () => {
    const room = createEventEmitterRoom('!test:example.com');
    const { container } = render(<Harness room={room} autoPinEnabled={false} />);
    const scrollEl = container.querySelector('[data-testid="scroll"]') as HTMLDivElement;
    const lastEl = container.querySelector('[data-testid="last-msg"]') as HTMLElement;
    const geom = stubScrollGeometry(scrollEl, { scrollHeight: 500, offsetHeight: 400 });
    geom.setScrollTop(100);
    act(() => {
      findObserverOf(lastEl)?.trigger(true);
    });
    act(() => {
      room.emit(RoomEvent.Timeline, createFakeEvent('m.room.message'), room, undefined, false, {
        liveEvent: true,
      });
    });
    expect(geom.getScrollTop()).toBe(100);
  });

  it('suppresses IO updates while a hook-initiated smooth scroll is in flight', () => {
    const room = createEventEmitterRoom('!test:example.com');
    const hookState: { current: UseJumpToLatest | null } = { current: null };
    const { container } = render(
      <Harness
        room={room}
        onHook={(h) => {
          hookState.current = h;
        }}
      />
    );
    const scrollEl = container.querySelector('[data-testid="scroll"]') as HTMLDivElement;
    const lastEl = container.querySelector('[data-testid="last-msg"]') as HTMLElement;
    stubScrollGeometry(scrollEl, { scrollHeight: 500, offsetHeight: 400 });
    act(() => {
      findObserverOf(lastEl)?.trigger(true);
    });
    expect(hookState.current!.isAtBottom).toBe(true);

    act(() => {
      hookState.current!.requestScrollToBottom(true);
    });

    act(() => {
      findObserverOf(lastEl)?.trigger(false);
    });
    expect(hookState.current!.isAtBottom).toBe(true);
  });

  it('clears IO suppression on scrollend', () => {
    const room = createEventEmitterRoom('!test:example.com');
    const hookState: { current: UseJumpToLatest | null } = { current: null };
    const { container } = render(
      <Harness
        room={room}
        onHook={(h) => {
          hookState.current = h;
        }}
      />
    );
    const scrollEl = container.querySelector('[data-testid="scroll"]') as HTMLDivElement;
    const lastEl = container.querySelector('[data-testid="last-msg"]') as HTMLElement;
    stubScrollGeometry(scrollEl, { scrollHeight: 500, offsetHeight: 400 });
    act(() => {
      findObserverOf(lastEl)?.trigger(true);
    });
    act(() => {
      hookState.current!.requestScrollToBottom(true);
    });
    act(() => {
      scrollEl.dispatchEvent(new Event('scrollend'));
    });
    act(() => {
      findObserverOf(lastEl)?.trigger(false);
    });
    expect(hookState.current!.isAtBottom).toBe(false);
  });

  it('ResizeObserver re-pins to bottom when at-bottom and content resizes', () => {
    const room = createEventEmitterRoom('!test:example.com');
    const { container } = render(<Harness room={room} />);
    const scrollEl = container.querySelector('[data-testid="scroll"]') as HTMLDivElement;
    const lastEl = container.querySelector('[data-testid="last-msg"]') as HTMLElement;
    const geom = stubScrollGeometry(scrollEl, { scrollHeight: 500, offsetHeight: 400 });
    geom.setScrollTop(100);
    act(() => {
      findObserverOf(lastEl)?.trigger(true);
    });

    expect(roInstances.length).toBeGreaterThan(0);
    const ro = roInstances[0];

    act(() => {
      ro.trigger();
    });
    expect(geom.getScrollTop()).toBe(100);

    geom.setScrollHeight(560);
    act(() => {
      ro.trigger();
    });
    expect(geom.getScrollTop()).toBe(560 - 400);
  });

  it('ResizeObserver does not re-pin when not at bottom', () => {
    const room = createEventEmitterRoom('!test:example.com');
    const { container } = render(<Harness room={room} />);
    const scrollEl = container.querySelector('[data-testid="scroll"]') as HTMLDivElement;
    const lastEl = container.querySelector('[data-testid="last-msg"]') as HTMLElement;
    const geom = stubScrollGeometry(scrollEl, { scrollHeight: 1000, offsetHeight: 400 });
    geom.setScrollTop(200);
    act(() => {
      findObserverOf(lastEl)?.trigger(false);
    });

    const ro = roInstances[0];
    act(() => {
      ro.trigger();
    });
    geom.setScrollHeight(1100);
    act(() => {
      ro.trigger();
    });
    expect(geom.getScrollTop()).toBe(200);
  });

  it('does not observe the last message when viewingLatest is false', () => {
    const room = createEventEmitterRoom('!test:example.com');
    const { container } = render(<Harness room={room} viewingLatest={false} />);
    const lastEl = container.querySelector('[data-testid="last-msg"]') as HTMLElement;
    expect(findObserverOf(lastEl)).toBeUndefined();
  });
});
