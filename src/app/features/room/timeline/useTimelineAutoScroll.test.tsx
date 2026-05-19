import React from 'react';
import { render, act } from '@testing-library/react';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import type { Room } from 'matrix-js-sdk';
import { RoomEvent } from 'matrix-js-sdk';
import type { TimelineAutoScroll } from './useTimelineAutoScroll';
import { useTimelineAutoScroll } from './useTimelineAutoScroll';
import {
  createEventEmitterRoom,
  createFakeEvent,
  installIntersectionObserverStub,
  ioInstances,
  stubScrollGeometry,
} from './timelineTestHelpers';

let originalIO: typeof IntersectionObserver | undefined;

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

  it('sets autoScrolling true during a smooth pin and clears it on scrollend', () => {
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
    geometry.setScrollTop(100);

    act(() => {
      ioInstances[0].trigger(true);
    });

    expect(hookState.current!.autoScrolling).toBe(false);

    geometry.setScrollHeight(600);
    act(() => {
      room.emit(RoomEvent.Timeline, createFakeEvent('m.room.message'), room, undefined, false, {
        liveEvent: true,
      });
    });

    expect(hookState.current!.autoScrolling).toBe(true);

    act(() => {
      scrollEl.dispatchEvent(new Event('scrollend'));
    });

    expect(hookState.current!.autoScrolling).toBe(false);
  });

  it('does not set autoScrolling for instant scrolls', () => {
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
    stubScrollGeometry(scrollEl, { scrollHeight: 1000, offsetHeight: 400 });

    act(() => {
      hookState.current!.requestScrollToBottom(false);
    });

    expect(hookState.current!.autoScrolling).toBe(false);
  });
});
