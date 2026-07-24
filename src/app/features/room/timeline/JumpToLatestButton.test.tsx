import type { RefObject } from 'react';
import React, { useRef } from 'react';
import { render, act } from '@testing-library/react';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { JumpToLatestButton } from './JumpToLatestButton';
import {
  findObserverOf,
  installIntersectionObserverStub,
  ioInstances,
} from './timelineTestHelpers';

let originalIO: typeof IntersectionObserver | undefined;

const MSG_A_ID = '$msg-a:example.com';
const MSG_B_ID = '$msg-b:example.com';
const MSG_C_ID = '$msg-c:example.com';

function Harness({
  lastMessageId = MSG_C_ID,
  renderRedactedLast = false,
  atBottom,
}: {
  lastMessageId?: string | null;
  renderRedactedLast?: boolean;
  atBottom: boolean;
}) {
  const scrollRef = useRef<HTMLDivElement>(null) as RefObject<HTMLDivElement>;
  return (
    <div ref={scrollRef} data-testid="timeline-scroll">
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
      <JumpToLatestButton
        scrollRef={scrollRef}
        lastMessageId={lastMessageId}
        atBottom={atBottom}
        onClick={() => undefined}
      />
    </div>
  );
}

function getVisibility(container: HTMLElement): string | null {
  const overlayElement = container.querySelector('[data-testid="jump-to-latest-overlay"]');
  return overlayElement?.getAttribute('data-visible') ?? null;
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

  it('stays hidden while the user is at the bottom', () => {
    const { container } = render(<Harness atBottom />);
    const lastItemElement = container.querySelector('[data-testid="last-msg"]') as HTMLElement;

    act(() => {
      findObserverOf(lastItemElement)?.trigger(true);
    });

    expect(getVisibility(container)).toBe('false');
  });

  it('becomes visible when the user scrolls up and the last message leaves the viewport', () => {
    const { container } = render(<Harness atBottom={false} />);
    const lastItemElement = container.querySelector('[data-testid="last-msg"]') as HTMLElement;

    act(() => {
      findObserverOf(lastItemElement)?.trigger(false);
    });

    expect(getVisibility(container)).toBe('true');
  });

  it('shows when lastMessageId is null and the user is not at the bottom', () => {
    const { container } = render(<Harness atBottom={false} lastMessageId={null} />);
    expect(getVisibility(container)).toBe('true');
  });

  it('hides again once the user returns to the bottom', () => {
    const { container, rerender } = render(<Harness atBottom={false} />);
    const lastItemElement = container.querySelector('[data-testid="last-msg"]') as HTMLElement;

    act(() => {
      findObserverOf(lastItemElement)?.trigger(false);
    });
    expect(getVisibility(container)).toBe('true');

    rerender(<Harness atBottom />);
    expect(getVisibility(container)).toBe('false');
  });

  // When the most recent message is redacted, the parent filters it out and
  // passes the previous message's id as the new last. The button must rebind
  // its observer to the new last element, otherwise the user can scroll up
  // (button shows) and back down (button stays visible) because the observer
  // is stuck on a detached node.
  it('rebinds to the new last message after the previous last is filtered out (redaction)', () => {
    const { container, rerender } = render(<Harness atBottom={false} />);
    const originalLast = container.querySelector('[data-testid="last-msg"]') as HTMLElement;

    act(() => {
      findObserverOf(originalLast)?.trigger(true);
    });
    expect(getVisibility(container)).toBe('false');

    rerender(<Harness atBottom={false} lastMessageId={MSG_B_ID} renderRedactedLast />);

    const newLast = container.querySelector(`[data-message-id="${MSG_B_ID}"]`) as HTMLElement;
    expect(newLast).not.toBeNull();

    act(() => {
      findObserverOf(newLast)?.trigger(false);
    });
    expect(getVisibility(container)).toBe('true');

    act(() => {
      findObserverOf(newLast)?.trigger(true);
    });
    expect(getVisibility(container)).toBe('false');
  });
});
