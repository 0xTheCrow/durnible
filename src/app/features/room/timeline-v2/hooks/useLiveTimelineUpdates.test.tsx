import React, { useRef, useState } from 'react';
import { render, act } from '@testing-library/react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import type { EventTimeline, MatrixEvent, Room } from 'matrix-js-sdk';
import { RoomEvent, RelationType } from 'matrix-js-sdk';
import { createEventEmitterRoom } from '../../timeline/timelineTestHelpers';
import type { Timeline } from '../../timeline/timelineState';
import { useLiveTimelineUpdates } from './useLiveTimelineUpdates';
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
  followingLive: boolean;
  unfocusedAutoScroll: boolean;
  totalEvents: number;
  pinToLiveEnd: () => void;
  onState: (timeline: Timeline) => void;
};

function Harness({
  room,
  followingLive,
  unfocusedAutoScroll,
  totalEvents,
  pinToLiveEnd,
  onState,
}: HarnessProps) {
  const [timeline, setTimeline] = useState<Timeline>({
    linkedTimelines: linkedTimelinesWithCount(totalEvents),
    range: { ...INITIAL_RANGE },
  });
  const intentRef = useRef<ScrollIntent>({ kind: 'free' });
  intentRef.current = followingLive ? { kind: 'followLive' } : { kind: 'free' };
  useLiveTimelineUpdates({
    room,
    setTimeline,
    intentRef,
    pinToLiveEnd,
    unfocusedAutoScroll,
  });
  onState(timeline);
  return null;
}

type Setup = Partial<
  Pick<HarnessProps, 'followingLive' | 'unfocusedAutoScroll' | 'totalEvents'>
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
      followingLive={overrides.followingLive ?? false}
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
    const { room, pinToLiveEnd, state } = setup({ followingLive: true });
    emit(room, reaction());
    expect(state.current?.range).toEqual(INITIAL_RANGE);
    expect(pinToLiveEnd).not.toHaveBeenCalled();
  });

  it('anchors the range to the live edge and pins live when following live while focused', () => {
    const totalEvents = INITIAL_RANGE.newest + 1;
    const { room, pinToLiveEnd, state } = setup({
      followingLive: true,
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

  it('does not shift the range when not following live', () => {
    const { room, pinToLiveEnd, state } = setup({
      followingLive: false,
      focused: true,
      totalEvents: INITIAL_RANGE.newest + 1,
    });
    emit(room, liveMessage());
    expect(state.current?.range).toEqual(INITIAL_RANGE);
    expect(pinToLiveEnd).not.toHaveBeenCalled();
  });

  it('does not shift the range while unfocused with unfocusedAutoScroll off, even when following live', () => {
    const { room, pinToLiveEnd, state } = setup({
      followingLive: true,
      focused: false,
      unfocusedAutoScroll: false,
      totalEvents: INITIAL_RANGE.newest + 1,
    });
    emit(room, liveMessage());
    expect(state.current?.range).toEqual(INITIAL_RANGE);
    expect(pinToLiveEnd).not.toHaveBeenCalled();
  });

  it('anchors the range to the live edge while unfocused when unfocusedAutoScroll is on', () => {
    const totalEvents = INITIAL_RANGE.newest + 1;
    const { room, pinToLiveEnd, state } = setup({
      followingLive: true,
      focused: false,
      unfocusedAutoScroll: true,
      totalEvents,
    });
    emit(room, liveMessage());
    expect(state.current?.range).toEqual({
      oldest: totalEvents - WINDOW_SIZE,
      newest: totalEvents,
    });
    expect(pinToLiveEnd).toHaveBeenCalledTimes(1);
  });
});
