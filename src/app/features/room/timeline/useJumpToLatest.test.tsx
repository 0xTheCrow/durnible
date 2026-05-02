import type { MutableRefObject } from 'react';
import React, { useRef } from 'react';
import { render, act } from '@testing-library/react';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import type { Room } from 'matrix-js-sdk';
import type { ApplyAnchor, ScrollAnchor, UseJumpToLatest } from './useJumpToLatest';
import { useJumpToLatest } from './useJumpToLatest';
import {
  createEventEmitterRoom,
  findObserverOf,
  installIntersectionObserverStub,
  ioInstances,
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

type HarnessProps = {
  room: Room;
  viewingLatest?: boolean;
  lastMessageKey?: string;
  attachLastRef?: boolean;
  autoPinEnabled?: boolean;
  initiallyAtBottom?: boolean;
  applyAnchor?: ApplyAnchor;
  onHook?: (hook: UseJumpToLatest, applyAnchorRef: MutableRefObject<ApplyAnchor>) => void;
};

function Harness({
  room,
  viewingLatest = true,
  lastMessageKey = '$last',
  attachLastRef = true,
  autoPinEnabled = true,
  initiallyAtBottom = true,
  applyAnchor,
  onHook,
}: HarnessProps) {
  const applyAnchorRef = useRef<ApplyAnchor>(applyAnchor ?? (() => {}));
  if (applyAnchor) applyAnchorRef.current = applyAnchor;

  const hook = useJumpToLatest({
    room,
    viewingLatest,
    autoPinEnabled,
    initiallyAtBottom,
    applyAnchorRef,
  });
  onHook?.(hook, applyAnchorRef);

  return (
    <div ref={hook.scrollRef} data-testid="scroll">
      <div ref={hook.contentRef} data-testid="content">
        <div>msg 0</div>
        <div>msg 1</div>
        <div
          key={lastMessageKey}
          ref={attachLastRef ? hook.lastMessageRef : undefined}
          data-testid="last-msg"
        >
          msg last
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

  it('does not observe the last message when viewingLatest is false', () => {
    const room = createEventEmitterRoom('!test:example.com');
    const { container } = render(<Harness room={room} viewingLatest={false} />);
    const lastEl = container.querySelector('[data-testid="last-msg"]') as HTMLElement;
    expect(findObserverOf(lastEl)).toBeUndefined();
  });

  it('re-targets IO when the last message DOM node is replaced (local echo → real event)', () => {
    const room = createEventEmitterRoom('!test:example.com');
    const { container, rerender } = render(<Harness room={room} lastMessageKey="~temp-echo" />);
    const oldEl = container.querySelector('[data-testid="last-msg"]') as HTMLElement;

    const firstObserver = findObserverOf(oldEl);
    expect(firstObserver).toBeDefined();

    rerender(<Harness room={room} lastMessageKey="$real-event" />);

    const newEl = container.querySelector('[data-testid="last-msg"]') as HTMLElement;
    expect(newEl).not.toBe(oldEl);
    const newObserver = findObserverOf(newEl);
    expect(newObserver).toBeDefined();
    expect(newObserver).not.toBe(firstObserver);
    expect(firstObserver!.observed.has(oldEl)).toBe(false);
  });

  it('setAnchor invokes applyAnchor on the next layout effect (deferred via state)', () => {
    const room = createEventEmitterRoom('!test:example.com');
    const hookState: { current: UseJumpToLatest | null } = { current: null };
    const applyAnchor = vi.fn() as unknown as ApplyAnchor & {
      mock: { calls: Parameters<ApplyAnchor>[] };
      mockClear: () => void;
    };
    render(
      <Harness
        room={room}
        applyAnchor={applyAnchor}
        onHook={(h) => {
          hookState.current = h;
        }}
      />
    );
    applyAnchor.mockClear();
    const anchor: ScrollAnchor = { kind: 'bottom' };
    act(() => {
      hookState.current!.setAnchor(anchor, 'smooth');
    });
    expect(applyAnchor).toHaveBeenCalledTimes(1);
    expect(applyAnchor).toHaveBeenCalledWith(anchor, 'smooth');
  });

  it('clearAnchor makes subsequent ResizeObserver fires a no-op', () => {
    const room = createEventEmitterRoom('!test:example.com');
    const hookState: { current: UseJumpToLatest | null } = { current: null };
    const applyAnchor = vi.fn() as unknown as ApplyAnchor & {
      mock: { calls: Parameters<ApplyAnchor>[] };
      mockClear: () => void;
    };
    render(
      <Harness
        room={room}
        applyAnchor={applyAnchor}
        onHook={(h) => {
          hookState.current = h;
        }}
      />
    );
    act(() => {
      hookState.current!.setAnchor({ kind: 'bottom' });
    });
    applyAnchor.mockClear();
    act(() => {
      hookState.current!.clearAnchor();
    });
    const ro = roInstances[0];
    act(() => {
      ro.trigger();
      ro.trigger();
    });
    expect(applyAnchor).not.toHaveBeenCalled();
  });

  it('ResizeObserver re-applies the current anchor on size change', () => {
    const room = createEventEmitterRoom('!test:example.com');
    const hookState: { current: UseJumpToLatest | null } = { current: null };
    const applyAnchor = vi.fn() as unknown as ApplyAnchor & {
      mock: { calls: Parameters<ApplyAnchor>[] };
      mockClear: () => void;
    };
    render(
      <Harness
        room={room}
        applyAnchor={applyAnchor}
        onHook={(h) => {
          hookState.current = h;
        }}
      />
    );
    const anchor: ScrollAnchor = { kind: 'event', eventId: '$x', align: 'start' };
    act(() => {
      hookState.current!.setAnchor(anchor);
    });
    applyAnchor.mockClear();
    const ro = roInstances[0];
    act(() => {
      ro.trigger();
    });
    expect(applyAnchor).toHaveBeenCalledTimes(1);
    expect(applyAnchor).toHaveBeenCalledWith(anchor, 'instant');
  });

  it('ResizeObserver no-ops when anchor=bottom and autoPinEnabled is false', () => {
    const room = createEventEmitterRoom('!test:example.com');
    const hookState: { current: UseJumpToLatest | null } = { current: null };
    const applyAnchor = vi.fn() as unknown as ApplyAnchor & {
      mock: { calls: Parameters<ApplyAnchor>[] };
      mockClear: () => void;
    };
    render(
      <Harness
        room={room}
        autoPinEnabled={false}
        applyAnchor={applyAnchor}
        onHook={(h) => {
          hookState.current = h;
        }}
      />
    );
    act(() => {
      hookState.current!.setAnchor({ kind: 'bottom' });
    });
    applyAnchor.mockClear();
    const ro = roInstances[0];
    act(() => {
      ro.trigger();
      ro.trigger();
    });
    expect(applyAnchor).not.toHaveBeenCalled();
  });

  it('ResizeObserver applies event anchor even when autoPinEnabled is false', () => {
    const room = createEventEmitterRoom('!test:example.com');
    const hookState: { current: UseJumpToLatest | null } = { current: null };
    const applyAnchor = vi.fn() as unknown as ApplyAnchor & {
      mock: { calls: Parameters<ApplyAnchor>[] };
      mockClear: () => void;
    };
    render(
      <Harness
        room={room}
        autoPinEnabled={false}
        applyAnchor={applyAnchor}
        onHook={(h) => {
          hookState.current = h;
        }}
      />
    );
    const anchor: ScrollAnchor = { kind: 'event', eventId: '$x', align: 'start' };
    act(() => {
      hookState.current!.setAnchor(anchor);
    });
    applyAnchor.mockClear();
    const ro = roInstances[0];
    act(() => {
      ro.trigger();
    });
    expect(applyAnchor).toHaveBeenCalledTimes(1);
    expect(applyAnchor).toHaveBeenCalledWith(anchor, 'instant');
  });

  it('IO intersecting sets anchor=bottom when no anchor is active', () => {
    const room = createEventEmitterRoom('!test:example.com');
    const hookState: { current: UseJumpToLatest | null } = { current: null };
    const applyAnchor = vi.fn() as unknown as ApplyAnchor & {
      mock: { calls: Parameters<ApplyAnchor>[] };
      mockClear: () => void;
    };
    const { container } = render(
      <Harness
        room={room}
        initiallyAtBottom={false}
        applyAnchor={applyAnchor}
        onHook={(h) => {
          hookState.current = h;
        }}
      />
    );
    const lastEl = container.querySelector('[data-testid="last-msg"]') as HTMLElement;
    act(() => {
      findObserverOf(lastEl)?.trigger(true);
    });
    applyAnchor.mockClear();
    const ro = roInstances[0];
    act(() => {
      ro.trigger();
      ro.trigger();
    });
    expect(applyAnchor).toHaveBeenCalledWith({ kind: 'bottom' }, 'instant');
  });

  it('IO not-intersecting clears anchor=bottom', () => {
    const room = createEventEmitterRoom('!test:example.com');
    const hookState: { current: UseJumpToLatest | null } = { current: null };
    const applyAnchor = vi.fn() as unknown as ApplyAnchor & {
      mock: { calls: Parameters<ApplyAnchor>[] };
      mockClear: () => void;
    };
    const { container } = render(
      <Harness
        room={room}
        applyAnchor={applyAnchor}
        onHook={(h) => {
          hookState.current = h;
        }}
      />
    );
    const lastEl = container.querySelector('[data-testid="last-msg"]') as HTMLElement;
    act(() => {
      findObserverOf(lastEl)?.trigger(true);
    });
    act(() => {
      findObserverOf(lastEl)?.trigger(false);
    });
    applyAnchor.mockClear();
    const ro = roInstances[0];
    act(() => {
      ro.trigger();
      ro.trigger();
    });
    expect(applyAnchor).not.toHaveBeenCalled();
  });

  it('IO intersecting does NOT override an active event anchor', () => {
    const room = createEventEmitterRoom('!test:example.com');
    const hookState: { current: UseJumpToLatest | null } = { current: null };
    const applyAnchor = vi.fn() as unknown as ApplyAnchor & {
      mock: { calls: Parameters<ApplyAnchor>[] };
      mockClear: () => void;
    };
    const { container } = render(
      <Harness
        room={room}
        initiallyAtBottom={false}
        applyAnchor={applyAnchor}
        onHook={(h) => {
          hookState.current = h;
        }}
      />
    );
    const eventAnchor: ScrollAnchor = { kind: 'event', eventId: '$x', align: 'start' };
    act(() => {
      hookState.current!.setAnchor(eventAnchor);
    });
    const lastEl = container.querySelector('[data-testid="last-msg"]') as HTMLElement;
    act(() => {
      findObserverOf(lastEl)?.trigger(true);
    });
    applyAnchor.mockClear();
    const ro = roInstances[0];
    act(() => {
      ro.trigger();
      ro.trigger();
    });
    expect(applyAnchor).toHaveBeenCalledWith(eventAnchor, 'instant');
  });

  it('mousedown clears event anchor but not bottom anchor', () => {
    const room = createEventEmitterRoom('!test:example.com');
    const hookState: { current: UseJumpToLatest | null } = { current: null };
    const applyAnchor = vi.fn() as unknown as ApplyAnchor & {
      mock: { calls: Parameters<ApplyAnchor>[] };
      mockClear: () => void;
    };
    const { container } = render(
      <Harness
        room={room}
        initiallyAtBottom={false}
        applyAnchor={applyAnchor}
        onHook={(h) => {
          hookState.current = h;
        }}
      />
    );
    const scrollEl = container.querySelector('[data-testid="scroll"]') as HTMLDivElement;

    // event anchor: mousedown should clear it.
    act(() => {
      hookState.current!.setAnchor({ kind: 'event', eventId: '$x', align: 'start' });
    });
    act(() => {
      scrollEl.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
    });
    applyAnchor.mockClear();
    const ro = roInstances[0];
    act(() => {
      ro.trigger();
      ro.trigger();
    });
    expect(applyAnchor).not.toHaveBeenCalled();

    // bottom anchor (set by IO): mousedown should leave it alone.
    const lastEl = container.querySelector('[data-testid="last-msg"]') as HTMLElement;
    act(() => {
      findObserverOf(lastEl)?.trigger(true);
    });
    act(() => {
      scrollEl.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
    });
    applyAnchor.mockClear();
    act(() => {
      ro.trigger();
    });
    expect(applyAnchor).toHaveBeenCalledWith({ kind: 'bottom' }, 'instant');
  });
});
