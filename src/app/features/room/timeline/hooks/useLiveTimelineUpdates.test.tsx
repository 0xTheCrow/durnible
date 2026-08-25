import React, { useRef, useState } from 'react';
import { render, act } from '@testing-library/react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import type { EventTimeline, MatrixEvent, Room } from 'matrix-js-sdk';
import { RoomEvent, RelationType } from 'matrix-js-sdk';
import { createEventEmitterRoom } from '../timelineTestHelpers';
import type { Timeline } from '../timelineState';
import { createTimelineWindow, getWindowRange } from '../utils/timelineWindow';
import { useLiveTimelineUpdates } from './useLiveTimelineUpdates';
import type { ScrollIntent } from './useScrollController';

const INITIAL_RANGE = { oldest: 5, newest: 10 };
const WINDOW_SIZE = INITIAL_RANGE.newest - INITIAL_RANGE.oldest;

const linkedTimelinesWithCount = (count: number): EventTimeline[] => {
  const events = Array.from(
    { length: count },
    (_unused, index) => ({ getId: () => `$e${index}` } as MatrixEvent)
  );
  return [{ getEvents: () => events }] as unknown as EventTimeline[];
};

const derivedRange = (timeline: Timeline | null | undefined) =>
  timeline ? getWindowRange(timeline.linkedTimelines, timeline.window) : undefined;

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
  followingLatestMessageBottom: boolean;
  wasLatestMessageBottomInView: boolean;
  isInLivePaginationWindow: boolean;
  unfocusedAutoScroll: boolean;
  totalEvents: number;
  pinToLatestMessageBottom: () => void;
  onState: (timeline: Timeline) => void;
};

function Harness({
  room,
  followingLatestMessageBottom,
  wasLatestMessageBottomInView,
  isInLivePaginationWindow,
  unfocusedAutoScroll,
  totalEvents,
  pinToLatestMessageBottom,
  onState,
}: HarnessProps) {
  const [timeline, setTimeline] = useState<Timeline>(() => {
    const linkedTimelines = linkedTimelinesWithCount(totalEvents);
    return {
      linkedTimelines,
      window: createTimelineWindow(linkedTimelines, INITIAL_RANGE.oldest, INITIAL_RANGE.newest),
    };
  });
  const scrollRef = useRef<HTMLDivElement>(null);
  const wasLatestMessageBottomInViewRef = useRef(wasLatestMessageBottomInView);
  wasLatestMessageBottomInViewRef.current = wasLatestMessageBottomInView;
  const isInLivePaginationWindowRef = useRef(isInLivePaginationWindow);
  isInLivePaginationWindowRef.current = isInLivePaginationWindow;
  const intentRef = useRef<ScrollIntent>({ kind: 'free' });
  intentRef.current = followingLatestMessageBottom
    ? { kind: 'latestMessageBottom' }
    : { kind: 'free' };
  useLiveTimelineUpdates({
    room,
    setTimeline,
    scrollRef,
    wasLatestMessageBottomInViewRef,
    isInLivePaginationWindowRef,
    intentRef,
    pinToLatestMessageBottom,
    unfocusedAutoScroll,
  });
  onState(timeline);
  return null;
}

type Setup = Partial<
  Pick<
    HarnessProps,
    | 'followingLatestMessageBottom'
    | 'wasLatestMessageBottomInView'
    | 'isInLivePaginationWindow'
    | 'unfocusedAutoScroll'
    | 'totalEvents'
  >
> & {
  focused?: boolean;
};

const setup = (overrides: Setup = {}) => {
  vi.spyOn(document, 'hasFocus').mockReturnValue(overrides.focused ?? true);
  const room = createEventEmitterRoom('!test:example.com');
  const pinToLatestMessageBottom = vi.fn();
  const state: { current: Timeline | null } = { current: null };
  render(
    <Harness
      room={room}
      followingLatestMessageBottom={overrides.followingLatestMessageBottom ?? false}
      wasLatestMessageBottomInView={overrides.wasLatestMessageBottomInView ?? false}
      isInLivePaginationWindow={overrides.isInLivePaginationWindow ?? false}
      unfocusedAutoScroll={overrides.unfocusedAutoScroll ?? false}
      totalEvents={overrides.totalEvents ?? INITIAL_RANGE.newest}
      pinToLatestMessageBottom={pinToLatestMessageBottom}
      onState={(timeline) => {
        state.current = timeline;
      }}
    />
  );
  return { room, pinToLatestMessageBottom, state };
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
    const { room, pinToLatestMessageBottom, state } = setup({
      followingLatestMessageBottom: true,
    });
    emit(room, reaction());
    expect(derivedRange(state.current)).toEqual(INITIAL_RANGE);
    expect(pinToLatestMessageBottom).not.toHaveBeenCalled();
  });

  it('anchors the range to the newest event and pins to it while following the latest message bottom while focused', () => {
    const totalEvents = INITIAL_RANGE.newest + 1;
    const { room, pinToLatestMessageBottom, state } = setup({
      followingLatestMessageBottom: true,
      focused: true,
      totalEvents,
    });
    emit(room, liveMessage());
    expect(derivedRange(state.current)).toEqual({
      oldest: totalEvents - WINDOW_SIZE,
      newest: totalEvents,
    });
    expect(pinToLatestMessageBottom).toHaveBeenCalledTimes(1);
  });

  it('anchors the range to the newest event when the latest message bottom was last observed visible without the follow intent', () => {
    const totalEvents = INITIAL_RANGE.newest + 1;
    const { room, pinToLatestMessageBottom, state } = setup({
      followingLatestMessageBottom: false,
      wasLatestMessageBottomInView: true,
      isInLivePaginationWindow: true,
      focused: true,
      totalEvents,
    });
    emit(room, liveMessage());
    expect(derivedRange(state.current)).toEqual({
      oldest: totalEvents - WINDOW_SIZE,
      newest: totalEvents,
    });
    expect(pinToLatestMessageBottom).toHaveBeenCalledTimes(1);
  });

  it('does not shift the range when the latest message bottom was observed visible in a window behind the newest event', () => {
    const { room, pinToLatestMessageBottom, state } = setup({
      followingLatestMessageBottom: false,
      wasLatestMessageBottomInView: true,
      isInLivePaginationWindow: false,
      focused: true,
      totalEvents: INITIAL_RANGE.newest + 1,
    });
    emit(room, liveMessage());
    expect(derivedRange(state.current)).toEqual(INITIAL_RANGE);
    expect(pinToLatestMessageBottom).not.toHaveBeenCalled();
  });

  it('does not shift the range when neither following nor last observed at the latest message bottom', () => {
    const { room, pinToLatestMessageBottom, state } = setup({
      followingLatestMessageBottom: false,
      wasLatestMessageBottomInView: false,
      isInLivePaginationWindow: true,
      focused: true,
      totalEvents: INITIAL_RANGE.newest + 1,
    });
    emit(room, liveMessage());
    expect(derivedRange(state.current)).toEqual(INITIAL_RANGE);
    expect(pinToLatestMessageBottom).not.toHaveBeenCalled();
  });

  it('advances the range without pinning while unfocused with unfocusedAutoScroll off', () => {
    const totalEvents = INITIAL_RANGE.newest + 1;
    const { room, pinToLatestMessageBottom, state } = setup({
      followingLatestMessageBottom: true,
      focused: false,
      unfocusedAutoScroll: false,
      totalEvents,
    });
    emit(room, liveMessage());
    expect(derivedRange(state.current)).toEqual({
      oldest: totalEvents - WINDOW_SIZE,
      newest: totalEvents,
    });
    expect(pinToLatestMessageBottom).not.toHaveBeenCalled();
  });

  it('anchors the range to the newest event while unfocused when unfocusedAutoScroll is on', () => {
    const totalEvents = INITIAL_RANGE.newest + 1;
    const { room, pinToLatestMessageBottom, state } = setup({
      followingLatestMessageBottom: true,
      focused: false,
      unfocusedAutoScroll: true,
      totalEvents,
    });
    emit(room, liveMessage());
    expect(derivedRange(state.current)).toEqual({
      oldest: totalEvents - WINDOW_SIZE,
      newest: totalEvents,
    });
    expect(pinToLatestMessageBottom).toHaveBeenCalledTimes(1);
  });
});
