import React, { useRef, useState } from 'react';
import { render, act } from '@testing-library/react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import type { MatrixEvent, Room } from 'matrix-js-sdk';
import { RoomEvent, RelationType } from 'matrix-js-sdk';
import { createEventEmitterRoom } from '../../timeline/timelineTestHelpers';
import type { Timeline } from '../../timeline/timelineState';
import { useLiveTimelineUpdates } from './useLiveTimelineUpdates';

const INITIAL_RANGE = { oldest: 5, newest: 10 };

const liveMessage = (): MatrixEvent =>
  ({
    getId: () => '$msg',
    getType: () => 'm.room.message',
    getRelation: () => null,
    isRedaction: () => false,
    isRedacted: () => false,
  } as unknown as MatrixEvent);

const reaction = (): MatrixEvent =>
  ({
    getId: () => '$rx',
    getType: () => 'm.reaction',
    getRelation: () => ({ rel_type: RelationType.Annotation }),
    isRedaction: () => false,
    isRedacted: () => false,
  } as unknown as MatrixEvent);

type HarnessProps = {
  room: Room;
  nearBottom: boolean;
  inWindow: boolean;
  unfocusedAutoScroll: boolean;
  pinToLiveEnd: () => void;
  onState: (timeline: Timeline) => void;
};

function Harness({
  room,
  nearBottom,
  inWindow,
  unfocusedAutoScroll,
  pinToLiveEnd,
  onState,
}: HarnessProps) {
  const [timeline, setTimeline] = useState<Timeline>({
    linkedTimelines: [],
    range: { ...INITIAL_RANGE },
  });
  const nearBottomRef = useRef(nearBottom);
  nearBottomRef.current = nearBottom;
  const inWindowRef = useRef(inWindow);
  inWindowRef.current = inWindow;
  useLiveTimelineUpdates({
    room,
    setTimeline,
    nearBottomRef,
    isInLivePaginationWindowRef: inWindowRef,
    pinToLiveEnd,
    unfocusedAutoScroll,
  });
  onState(timeline);
  return null;
}

type Setup = Partial<Pick<HarnessProps, 'nearBottom' | 'inWindow' | 'unfocusedAutoScroll'>> & {
  focused?: boolean;
};

const setup = (overrides: Setup = {}) => {
  vi.spyOn(document, 'hasFocus').mockReturnValue(overrides.focused ?? true);
  const room = createEventEmitterRoom('!test:example.com');
  const pinToLiveEnd = vi.fn();
  const state: { current: Timeline | null } = { current: null };
  render(
    <Harness
      room={room}
      nearBottom={overrides.nearBottom ?? true}
      inWindow={overrides.inWindow ?? true}
      unfocusedAutoScroll={overrides.unfocusedAutoScroll ?? false}
      pinToLiveEnd={pinToLiveEnd}
      onState={(timeline) => {
        state.current = timeline;
      }}
    />
  );
  return { room, pinToLiveEnd, state };
};

const emit = (
  room: Room & { emit: (event: string, ...args: unknown[]) => boolean },
  event: MatrixEvent
) => {
  act(() => {
    room.emit(RoomEvent.Timeline, event, room, undefined, false, { liveEvent: true });
  });
};

afterEach(() => {
  vi.restoreAllMocks();
});

describe('useLiveTimelineUpdates', () => {
  it('re-renders without shifting the range for a modifier event', () => {
    const { room, pinToLiveEnd, state } = setup();
    emit(room, reaction());
    expect(state.current?.range).toEqual(INITIAL_RANGE);
    expect(pinToLiveEnd).not.toHaveBeenCalled();
  });

  it('shifts the range and pins live when at the bottom of the live window while focused', () => {
    const { room, pinToLiveEnd, state } = setup({
      nearBottom: true,
      inWindow: true,
      focused: true,
    });
    emit(room, liveMessage());
    expect(state.current?.range).toEqual({
      oldest: INITIAL_RANGE.oldest + 1,
      newest: INITIAL_RANGE.newest + 1,
    });
    expect(pinToLiveEnd).toHaveBeenCalledTimes(1);
  });

  it('does not shift the range when not near the bottom', () => {
    const { room, pinToLiveEnd, state } = setup({ nearBottom: false });
    emit(room, liveMessage());
    expect(state.current?.range).toEqual(INITIAL_RANGE);
    expect(pinToLiveEnd).not.toHaveBeenCalled();
  });

  it('does not shift the range while unfocused with unfocusedAutoScroll off', () => {
    const { room, pinToLiveEnd, state } = setup({
      nearBottom: true,
      inWindow: true,
      focused: false,
      unfocusedAutoScroll: false,
    });
    emit(room, liveMessage());
    expect(state.current?.range).toEqual(INITIAL_RANGE);
    expect(pinToLiveEnd).not.toHaveBeenCalled();
  });
});
