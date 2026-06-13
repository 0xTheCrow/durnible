import React from 'react';
import { render, act } from '@testing-library/react';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import type { Room } from 'matrix-js-sdk';
import { RoomEvent } from 'matrix-js-sdk';
import { useTimelineAutoScroll } from './useTimelineAutoScroll';
import { JumpToLatestButton } from './JumpToLatestButton';
import {
  createEventEmitterRoom,
  createFakeEvent,
  findObserverOf,
  installIntersectionObserverStub,
  ioInstances,
  stubScrollGeometry,
} from './timelineTestHelpers';

let originalIO: typeof IntersectionObserver | undefined;

const MSG_A_ID = '$msg-a:example.com';
const MSG_B_ID = '$msg-b:example.com';
const MSG_C_ID = '$msg-c:example.com';

function Harness({
  room,
  lastMessageId = MSG_C_ID,
  renderRedactedLast = false,
}: {
  room: Room;
  lastMessageId?: string | null;
  renderRedactedLast?: boolean;
}) {
  const hook = useTimelineAutoScroll({ room, viewingLatest: true });
  return (
    <div ref={hook.scrollRef} data-testid="timeline-scroll">
      <div data-message-id={MSG_A_ID} data-testid="msg-0">
        msg A
      </div>
      <div data-message-id={MSG_B_ID} data-testid="msg-1">
        msg B
      </div>
      {!renderRedactedLast && (
        <div data-message-id={MSG_C_ID} data-testid="last-msg">
          msg C
        </div>
      )}
      <span ref={hook.atBottomAnchorRef} data-testid="bottom-sentinel" />
      <JumpToLatestButton
        scrollRef={hook.scrollRef}
        lastMessageId={lastMessageId}
        atBottom={hook.atBottom}
        autoScrolling={hook.autoScrolling}
        onClick={() => undefined}
      />
    </div>
  );
}

function getVisibility(container: HTMLElement): string | null {
  const el = container.querySelector('[data-testid="jump-to-latest-overlay"]');
  return el?.getAttribute('data-visible') ?? null;
}

describe('JumpToLatestButton', () => {
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

  it('stays hidden when the user is at the bottom and the last message is visible', () => {
    const room = createEventEmitterRoom('!test:example.com');
    const { container } = render(<Harness room={room} />);
    const scrollEl = container.querySelector('[data-testid="timeline-scroll"]') as HTMLDivElement;
    const lastEl = container.querySelector('[data-testid="last-msg"]') as HTMLElement;
    const sentinel = container.querySelector('[data-testid="bottom-sentinel"]') as HTMLElement;
    stubScrollGeometry(scrollEl, { scrollHeight: 500, offsetHeight: 400 });

    act(() => {
      findObserverOf(sentinel)?.trigger(true);
      findObserverOf(lastEl)?.trigger(true);
    });

    expect(getVisibility(container)).toBe('false');
  });

  it('stays hidden when a reaction arrives while the user is at the bottom, even if observer state transiently flips during the smooth scroll', () => {
    const room = createEventEmitterRoom('!test:example.com');
    const { container } = render(<Harness room={room} />);
    const scrollEl = container.querySelector('[data-testid="timeline-scroll"]') as HTMLDivElement;
    const lastEl = container.querySelector('[data-testid="last-msg"]') as HTMLElement;
    const sentinel = container.querySelector('[data-testid="bottom-sentinel"]') as HTMLElement;
    const geometry = stubScrollGeometry(scrollEl, { scrollHeight: 500, offsetHeight: 400 });
    geometry.setScrollTop(100);

    act(() => {
      findObserverOf(sentinel)?.trigger(true);
      findObserverOf(lastEl)?.trigger(true);
    });
    expect(getVisibility(container)).toBe('false');

    // Reaction arrives. The reaction chip grows the scroll content; the hook
    // requests a smooth pin-to-bottom and sets autoScrolling.
    geometry.setScrollHeight(600);
    act(() => {
      room.emit(RoomEvent.Timeline, createFakeEvent('m.reaction'), room, undefined, false, {
        liveEvent: true,
      });
    });

    // Mid-animation: both observers can transiently report out-of-view as the
    // DOM grows before the scroll catches up. Pre-fix, this flipped the button
    // visible. With the autoScrolling gate, it must stay hidden regardless of
    // which observer flips.
    act(() => {
      findObserverOf(sentinel)?.trigger(false);
      findObserverOf(lastEl)?.trigger(false);
    });
    expect(getVisibility(container)).toBe('false');

    // Scroll settles: browser fires scrollend, observers intersect again.
    act(() => {
      scrollEl.dispatchEvent(new Event('scrollend'));
      findObserverOf(sentinel)?.trigger(true);
      findObserverOf(lastEl)?.trigger(true);
    });
    expect(getVisibility(container)).toBe('false');
  });

  it('becomes visible when the user scrolls up and the last message leaves the viewport', () => {
    const room = createEventEmitterRoom('!test:example.com');
    const { container } = render(<Harness room={room} />);
    const scrollEl = container.querySelector('[data-testid="timeline-scroll"]') as HTMLDivElement;
    const lastEl = container.querySelector('[data-testid="last-msg"]') as HTMLElement;
    const sentinel = container.querySelector('[data-testid="bottom-sentinel"]') as HTMLElement;
    stubScrollGeometry(scrollEl, { scrollHeight: 1000, offsetHeight: 400 });

    act(() => {
      findObserverOf(sentinel)?.trigger(false);
      findObserverOf(lastEl)?.trigger(false);
    });

    expect(getVisibility(container)).toBe('true');
  });

  it('shows when lastMessageId is null and the user is not at the bottom', () => {
    const room = createEventEmitterRoom('!test:example.com');
    const { container } = render(<Harness room={room} lastMessageId={null} />);
    const scrollEl = container.querySelector('[data-testid="timeline-scroll"]') as HTMLDivElement;
    const sentinel = container.querySelector('[data-testid="bottom-sentinel"]') as HTMLElement;
    stubScrollGeometry(scrollEl, { scrollHeight: 1000, offsetHeight: 400 });

    act(() => {
      findObserverOf(sentinel)?.trigger(false);
    });

    expect(getVisibility(container)).toBe('true');
  });

  it('hides again once the user returns to the bottom', () => {
    const room = createEventEmitterRoom('!test:example.com');
    const { container } = render(<Harness room={room} />);
    const scrollEl = container.querySelector('[data-testid="timeline-scroll"]') as HTMLDivElement;
    const lastEl = container.querySelector('[data-testid="last-msg"]') as HTMLElement;
    const sentinel = container.querySelector('[data-testid="bottom-sentinel"]') as HTMLElement;
    stubScrollGeometry(scrollEl, { scrollHeight: 1000, offsetHeight: 400 });

    act(() => {
      findObserverOf(sentinel)?.trigger(false);
      findObserverOf(lastEl)?.trigger(false);
    });
    expect(getVisibility(container)).toBe('true');

    act(() => {
      findObserverOf(sentinel)?.trigger(true);
      findObserverOf(lastEl)?.trigger(true);
    });
    expect(getVisibility(container)).toBe('false');
  });

  // When the most recent message is redacted, the parent filters it out and
  // passes the previous message's id as the new last. The button must rebind
  // its observer to the new last element, otherwise the user can scroll up
  // (button shows) and back down (button stays visible) because the observer
  // is stuck on a detached node.
  it('rebinds to the new last message after the previous last is filtered out (redaction)', () => {
    const room = createEventEmitterRoom('!test:example.com');
    const { container, rerender } = render(<Harness room={room} />);
    const scrollEl = container.querySelector('[data-testid="timeline-scroll"]') as HTMLDivElement;
    const originalLast = container.querySelector('[data-testid="last-msg"]') as HTMLElement;
    const sentinel = container.querySelector('[data-testid="bottom-sentinel"]') as HTMLElement;
    stubScrollGeometry(scrollEl, { scrollHeight: 500, offsetHeight: 400 });

    act(() => {
      findObserverOf(sentinel)?.trigger(true);
      findObserverOf(originalLast)?.trigger(true);
    });
    expect(getVisibility(container)).toBe('false');

    // Simulate the original last being redacted: parent stops rendering it and
    // passes the previous message's id as the new last.
    rerender(<Harness room={room} lastMessageId={MSG_B_ID} renderRedactedLast />);

    const newLast = container.querySelector(`[data-message-id="${MSG_B_ID}"]`) as HTMLElement;
    expect(newLast).not.toBeNull();

    // User scrolls up: sentinel and the new last both leave view. Button shows.
    act(() => {
      findObserverOf(sentinel)?.trigger(false);
      findObserverOf(newLast)?.trigger(false);
    });
    expect(getVisibility(container)).toBe('true');

    // User scrolls back down: sentinel and the new last intersect again. The
    // observer must be on the new element for this to flip lastMsgVisible
    // back to true and hide the button.
    act(() => {
      findObserverOf(sentinel)?.trigger(true);
      findObserverOf(newLast)?.trigger(true);
    });
    expect(getVisibility(container)).toBe('false');
  });
});
