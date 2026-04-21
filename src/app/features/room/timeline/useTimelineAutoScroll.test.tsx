import React from 'react';
import { render, act } from '@testing-library/react';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { EventEmitter } from 'events';
import type { MatrixEvent, Room } from 'matrix-js-sdk';
import { RoomEvent } from 'matrix-js-sdk';
import type { TimelineAutoScroll } from './useTimelineAutoScroll';
import { useTimelineAutoScroll } from './useTimelineAutoScroll';

type FakeIntersectionObserver = {
  callback: IntersectionObserverCallback;
  observed: Set<Element>;
  observe: (target: Element) => void;
  unobserve: (target: Element) => void;
  disconnect: () => void;
  trigger: (isIntersecting: boolean) => void;
};

const ioInstances: FakeIntersectionObserver[] = [];
let originalIO: typeof IntersectionObserver | undefined;

function createFakeIntersectionObserver(
  cb: IntersectionObserverCallback
): FakeIntersectionObserver {
  const instance: FakeIntersectionObserver = {
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
    trigger(isIntersecting) {
      const rect = {
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        width: 0,
        height: 0,
        x: 0,
        y: 0,
        toJSON() {
          return {};
        },
      } as DOMRectReadOnly;
      const entries: IntersectionObserverEntry[] = Array.from(instance.observed).map((target) => ({
        target,
        isIntersecting,
        intersectionRatio: isIntersecting ? 1 : 0,
        boundingClientRect: rect,
        intersectionRect: rect,
        rootBounds: null,
        time: 0,
      }));
      instance.callback(entries, instance as unknown as IntersectionObserver);
    },
  };
  return instance;
}

function installIntersectionObserverStub() {
  ioInstances.length = 0;
  const ctor = function StubIntersectionObserver(
    this: IntersectionObserver,
    cb: IntersectionObserverCallback
  ) {
    const instance = createFakeIntersectionObserver(cb);
    ioInstances.push(instance);
    return instance as unknown as IntersectionObserver;
  } as unknown as typeof IntersectionObserver;
  (
    globalThis as unknown as { IntersectionObserver: typeof IntersectionObserver }
  ).IntersectionObserver = ctor;
}

function createEventEmitterRoom(roomId: string): Room & {
  emit: (event: string, ...args: unknown[]) => boolean;
} {
  const emitter = new EventEmitter();
  const room = {
    roomId,
    on: (ev: string, fn: (...args: unknown[]) => void) => {
      emitter.on(ev, fn);
      return room;
    },
    off: (ev: string, fn: (...args: unknown[]) => void) => {
      emitter.off(ev, fn);
      return room;
    },
    removeListener: (ev: string, fn: (...args: unknown[]) => void) => {
      emitter.removeListener(ev, fn);
      return room;
    },
    emit: (ev: string, ...args: unknown[]) => emitter.emit(ev, ...args),
  };
  return room as unknown as Room & {
    emit: (event: string, ...args: unknown[]) => boolean;
  };
}

function createFakeEvent(type: string): MatrixEvent {
  const id = `$${Math.random().toString(36).slice(2)}`;
  return {
    getId: () => id,
    getType: () => type,
    getContent: () => ({}),
    getRoomId: () => '!test:example.com',
    getSender: () => '@alice:example.com',
    isRedacted: () => false,
  } as unknown as MatrixEvent;
}

type ScrollGeometry = {
  setScrollHeight: (value: number) => void;
  getScrollTop: () => number;
  setScrollTop: (value: number) => void;
  getLastScrollBehavior: () => string | undefined;
};

function stubScrollGeometry(
  el: HTMLElement,
  initial: { scrollHeight: number; offsetHeight: number }
): ScrollGeometry {
  let scrollTop = 0;
  let scrollHeight = initial.scrollHeight;
  let lastBehavior: string | undefined;
  const { offsetHeight } = initial;

  Object.defineProperty(el, 'scrollHeight', {
    configurable: true,
    get: () => scrollHeight,
  });
  Object.defineProperty(el, 'offsetHeight', {
    configurable: true,
    get: () => offsetHeight,
  });
  Object.defineProperty(el, 'clientHeight', {
    configurable: true,
    get: () => offsetHeight,
  });
  Object.defineProperty(el, 'scrollTop', {
    configurable: true,
    get: () => scrollTop,
    set: (v: number) => {
      scrollTop = v;
    },
  });
  Object.defineProperty(el, 'scrollTo', {
    configurable: true,
    writable: true,
    value: (arg: ScrollToOptions | number, y?: number) => {
      if (typeof arg === 'number') {
        scrollTop = y ?? 0;
        return;
      }
      if (arg && typeof arg === 'object') {
        if (typeof arg.top === 'number') scrollTop = arg.top;
        lastBehavior = arg.behavior;
      }
    },
  });

  return {
    setScrollHeight: (value) => {
      scrollHeight = value;
    },
    getScrollTop: () => scrollTop,
    setScrollTop: (value) => {
      scrollTop = value;
    },
    getLastScrollBehavior: () => lastBehavior,
  };
}

type HarnessProps = {
  room: Room;
  viewingLatest: boolean;
  renderDivider?: boolean;
  autoPinEnabled?: boolean;
  initiallyAtBottom?: boolean;
  onHook?: (hook: TimelineAutoScroll) => void;
};

function Harness({
  room,
  viewingLatest,
  renderDivider,
  autoPinEnabled = true,
  initiallyAtBottom = true,
  onHook,
}: HarnessProps) {
  const hook = useTimelineAutoScroll({
    room,
    viewingLatest,
    autoPinEnabled,
    initiallyAtBottom,
  });
  onHook?.(hook);
  const { scrollRef, atBottomAnchorRef } = hook;

  return (
    <div ref={scrollRef} data-testid="timeline-scroll">
      {renderDivider && <div data-testid="new-messages-divider">New Messages</div>}
      <div data-testid="msg">message 1</div>
      <div data-testid="msg">message 2</div>
      <div data-testid="msg">message 3</div>
      <span ref={atBottomAnchorRef} data-testid="timeline-bottom-sentinel" />
    </div>
  );
}

describe('useTimelineAutoScroll', () => {
  beforeEach(() => {
    originalIO = (globalThis as unknown as { IntersectionObserver: typeof IntersectionObserver })
      .IntersectionObserver;
    installIntersectionObserverStub();
  });

  afterEach(() => {
    if (originalIO) {
      (
        globalThis as unknown as { IntersectionObserver: typeof IntersectionObserver }
      ).IntersectionObserver = originalIO;
    }
    ioInstances.length = 0;
  });

  it('keeps scroll pinned to the bottom when a reaction is added to the latest message', () => {
    const room = createEventEmitterRoom('!test:example.com');

    const { container } = render(<Harness room={room} viewingLatest />);

    const scrollEl = container.querySelector('[data-testid="timeline-scroll"]') as HTMLDivElement;
    expect(scrollEl).not.toBeNull();
    // Initial layout: content fits in a 400px viewport with 500px of content.
    // scrollTop at 100 means the sentinel is visible and the user is at the
    // bottom of the scroll container.
    const geometry = stubScrollGeometry(scrollEl, { scrollHeight: 500, offsetHeight: 400 });
    geometry.setScrollTop(100);

    // The IntersectionObserver reports the sentinel as visible — the hook
    // flips atBottom to true.
    expect(ioInstances.length).toBeGreaterThan(0);
    act(() => {
      ioInstances[0].trigger(true);
    });

    // A reaction is dispatched on the latest message. It adds a chip that
    // grows the content height by 20px. The hook must still pin the viewport
    // to the new bottom.
    geometry.setScrollHeight(520);
    act(() => {
      room.emit(RoomEvent.Timeline, createFakeEvent('m.reaction'), room, undefined, false, {
        liveEvent: true,
      });
    });

    // scrollTop should equal scrollHeight − offsetHeight = 120. The bug was
    // that reactions skipped the scroll-pin path and scrollTop stayed at 100,
    // leaving the sentinel (and new chip) below the visible area.
    expect(geometry.getScrollTop()).toBe(520 - 400);
  });

  it('keeps scroll pinned when a new live message arrives while the new-messages divider is visible', () => {
    const room = createEventEmitterRoom('!test:example.com');

    const { container } = render(<Harness room={room} viewingLatest renderDivider />);

    const scrollEl = container.querySelector('[data-testid="timeline-scroll"]') as HTMLDivElement;
    const divider = container.querySelector('[data-testid="new-messages-divider"]');
    expect(scrollEl).not.toBeNull();
    expect(divider).not.toBeNull();

    const geometry = stubScrollGeometry(scrollEl, { scrollHeight: 600, offsetHeight: 400 });
    geometry.setScrollTop(200);

    act(() => {
      ioInstances[0].trigger(true);
    });

    // New normal message arrives. It pushes content down by 40px.
    geometry.setScrollHeight(640);
    act(() => {
      room.emit(RoomEvent.Timeline, createFakeEvent('m.room.message'), room, undefined, false, {
        liveEvent: true,
      });
    });

    expect(geometry.getScrollTop()).toBe(640 - 400);
  });

  it('requestScrollToBottom scrolls with smooth behavior by default', () => {
    const room = createEventEmitterRoom('!test:example.com');
    const hookState: { current: TimelineAutoScroll | null } = { current: null };

    const { container } = render(
      <Harness
        room={room}
        viewingLatest
        onHook={(h) => {
          hookState.current = h;
        }}
      />
    );

    const scrollEl = container.querySelector('[data-testid="timeline-scroll"]') as HTMLDivElement;
    const geometry = stubScrollGeometry(scrollEl, { scrollHeight: 500, offsetHeight: 400 });
    geometry.setScrollTop(0);

    act(() => {
      hookState.current!.requestScrollToBottom();
    });

    expect(geometry.getLastScrollBehavior()).toBe('smooth');
  });

  it('requestScrollToBottom scrolls with instant behavior when smooth is false', () => {
    const room = createEventEmitterRoom('!test:example.com');
    const hookState: { current: TimelineAutoScroll | null } = { current: null };

    const { container } = render(
      <Harness
        room={room}
        viewingLatest
        onHook={(h) => {
          hookState.current = h;
        }}
      />
    );

    const scrollEl = container.querySelector('[data-testid="timeline-scroll"]') as HTMLDivElement;
    const geometry = stubScrollGeometry(scrollEl, { scrollHeight: 500, offsetHeight: 400 });
    geometry.setScrollTop(0);

    act(() => {
      hookState.current!.requestScrollToBottom(false);
    });

    expect(geometry.getLastScrollBehavior()).toBe('instant');
  });

  it('does not auto-scroll when not at bottom', () => {
    const room = createEventEmitterRoom('!test:example.com');

    const { container } = render(<Harness room={room} viewingLatest />);

    const scrollEl = container.querySelector('[data-testid="timeline-scroll"]') as HTMLDivElement;
    const geometry = stubScrollGeometry(scrollEl, { scrollHeight: 1000, offsetHeight: 400 });
    geometry.setScrollTop(200);

    act(() => {
      ioInstances[0].trigger(false);
    });

    geometry.setScrollHeight(1040);
    act(() => {
      room.emit(RoomEvent.Timeline, createFakeEvent('m.room.message'), room, undefined, false, {
        liveEvent: true,
      });
    });

    expect(geometry.getScrollTop()).toBe(200);
  });

  it('does not auto-scroll when viewingLatest is false', () => {
    const room = createEventEmitterRoom('!test:example.com');

    const { container } = render(<Harness room={room} viewingLatest={false} />);

    const scrollEl = container.querySelector('[data-testid="timeline-scroll"]') as HTMLDivElement;
    const geometry = stubScrollGeometry(scrollEl, { scrollHeight: 500, offsetHeight: 400 });
    geometry.setScrollTop(100);

    act(() => {
      ioInstances[0].trigger(true);
    });

    geometry.setScrollHeight(540);
    act(() => {
      room.emit(RoomEvent.Timeline, createFakeEvent('m.room.message'), room, undefined, false, {
        liveEvent: true,
      });
    });

    expect(geometry.getScrollTop()).toBe(100);
  });

  it('auto-scrolls on redaction when pinned to bottom', () => {
    const room = createEventEmitterRoom('!test:example.com');

    const { container } = render(<Harness room={room} viewingLatest />);

    const scrollEl = container.querySelector('[data-testid="timeline-scroll"]') as HTMLDivElement;
    const geometry = stubScrollGeometry(scrollEl, { scrollHeight: 500, offsetHeight: 400 });
    geometry.setScrollTop(100);

    act(() => {
      ioInstances[0].trigger(true);
    });

    geometry.setScrollHeight(460);
    act(() => {
      room.emit(RoomEvent.Redaction, createFakeEvent('m.room.redaction'), room);
    });

    expect(geometry.getScrollTop()).toBe(460 - 400);
  });

  it('sets atBottom to false when anchor stops intersecting', () => {
    const room = createEventEmitterRoom('!test:example.com');
    const hookState: { current: TimelineAutoScroll | null } = { current: null };

    const { container } = render(
      <Harness
        room={room}
        viewingLatest
        onHook={(h) => {
          hookState.current = h;
        }}
      />
    );

    const scrollEl = container.querySelector('[data-testid="timeline-scroll"]') as HTMLDivElement;
    stubScrollGeometry(scrollEl, { scrollHeight: 500, offsetHeight: 400 });

    act(() => {
      ioInstances[0].trigger(true);
    });
    expect(hookState.current!.atBottom).toBe(true);

    act(() => {
      ioInstances[0].trigger(false);
    });
    expect(hookState.current!.atBottom).toBe(false);
  });

  it('does not set atBottom to true when viewingLatest is false', () => {
    const room = createEventEmitterRoom('!test:example.com');
    const hookState: { current: TimelineAutoScroll | null } = { current: null };

    const { container } = render(
      <Harness
        room={room}
        viewingLatest={false}
        onHook={(h) => {
          hookState.current = h;
        }}
        initiallyAtBottom={false}
      />
    );

    const scrollEl = container.querySelector('[data-testid="timeline-scroll"]') as HTMLDivElement;
    stubScrollGeometry(scrollEl, { scrollHeight: 500, offsetHeight: 400 });

    act(() => {
      ioInstances[0].trigger(true);
    });
    expect(hookState.current!.atBottom).toBe(false);
  });
});
