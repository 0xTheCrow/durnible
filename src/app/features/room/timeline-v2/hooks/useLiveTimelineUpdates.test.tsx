import React, { useRef, useState } from 'react';
import { render, act } from '@testing-library/react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import type { EventTimeline, MatrixEvent, Room } from 'matrix-js-sdk';
import { RoomEvent, RelationType } from 'matrix-js-sdk';
import { createEventEmitterRoom } from '../../timeline/timelineTestHelpers';
import type { Timeline } from '../../timeline/timelineState';
import { useLiveTimelineUpdates, NEAR_BOTTOM_THRESHOLD_PX } from './useLiveTimelineUpdates';
import type { ScrollIntent } from './useScrollController';

const INITIAL_RANGE = { oldest: 5, newest: 10 };
const WINDOW_SIZE = INITIAL_RANGE.newest - INITIAL_RANGE.oldest;

const linkedTimelinesWithCount = (count: number): EventTimeline[] =>
  [{ getEvents: () => new Array(count) }] as unknown as EventTimeline[];

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
  followingLive: boolean;
  inWindow: boolean;
  unfocusedAutoScroll: boolean;
  totalEvents: number;
  pinToLiveEnd: () => void;
  onState: (timeline: Timeline) => void;
};

function Harness({
  room,
  nearBottom,
  followingLive,
  inWindow,
  unfocusedAutoScroll,
  totalEvents,
  pinToLiveEnd,
  onState,
}: HarnessProps) {
  const [timeline, setTimeline] = useState<Timeline>({
    linkedTimelines: linkedTimelinesWithCount(totalEvents),
    range: { ...INITIAL_RANGE },
  });
  const bottomDistance = nearBottom ? 0 : NEAR_BOTTOM_THRESHOLD_PX + 1;
  const scrollElement = {
    scrollHeight: bottomDistance,
    offsetHeight: 0,
    scrollTop: 0,
  } as unknown as HTMLDivElement;
  const scrollRef = useRef(scrollElement);
  scrollRef.current = scrollElement;
  const inWindowRef = useRef(inWindow);
  inWindowRef.current = inWindow;
  const intentRef = useRef<ScrollIntent>({ kind: 'free' });
  intentRef.current = followingLive ? { kind: 'followLive' } : { kind: 'free' };
  useLiveTimelineUpdates({
    room,
    setTimeline,
    scrollRef,
    isInLivePaginationWindowRef: inWindowRef,
    intentRef,
    pinToLiveEnd,
    unfocusedAutoScroll,
  });
  onState(timeline);
  return null;
}

type Setup = Partial<
  Pick<
    HarnessProps,
    'nearBottom' | 'followingLive' | 'inWindow' | 'unfocusedAutoScroll' | 'totalEvents'
  >
> & {
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
      followingLive={overrides.followingLive ?? false}
      inWindow={overrides.inWindow ?? true}
      unfocusedAutoScroll={overrides.unfocusedAutoScroll ?? false}
      totalEvents={overrides.totalEvents ?? INITIAL_RANGE.newest}
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

  it('anchors the range to the live edge and pins live when at the bottom while focused', () => {
    const totalEvents = INITIAL_RANGE.newest + 1;
    const { room, pinToLiveEnd, state } = setup({
      nearBottom: true,
      inWindow: true,
      focused: true,
      totalEvents,
    });
    emit(room, liveMessage());
    expect(state.current?.range).toEqual({
      oldest: totalEvents - WINDOW_SIZE,
      newest: totalEvents,
    });
    expect(pinToLiveEnd).toHaveBeenCalledTimes(1);
  });

  it('anchors past a trailing modifier gap so the new message stays in the window', () => {
    const totalEvents = INITIAL_RANGE.newest + 2;
    const { room, pinToLiveEnd, state } = setup({
      nearBottom: true,
      inWindow: true,
      focused: true,
      totalEvents,
    });
    emit(room, liveMessage());
    expect(state.current?.range).toEqual({
      oldest: totalEvents - WINDOW_SIZE,
      newest: totalEvents,
    });
    expect(pinToLiveEnd).toHaveBeenCalledTimes(1);
  });

  it('does not shift the range when not near the bottom and not following live', () => {
    const { room, pinToLiveEnd, state } = setup({ nearBottom: false, followingLive: false });
    emit(room, liveMessage());
    expect(state.current?.range).toEqual(INITIAL_RANGE);
    expect(pinToLiveEnd).not.toHaveBeenCalled();
  });

  it('anchors to the live edge when following live even if geometry reads not-near-bottom', () => {
    const totalEvents = INITIAL_RANGE.newest + 1;
    const { room, pinToLiveEnd, state } = setup({
      nearBottom: false,
      followingLive: true,
      inWindow: true,
      focused: true,
      totalEvents,
    });
    emit(room, liveMessage());
    expect(state.current?.range).toEqual({
      oldest: totalEvents - WINDOW_SIZE,
      newest: totalEvents,
    });
    expect(pinToLiveEnd).toHaveBeenCalledTimes(1);
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
