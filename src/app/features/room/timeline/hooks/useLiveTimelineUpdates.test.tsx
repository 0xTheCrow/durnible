import React, { useRef, useState } from 'react';
import { render, act } from '@testing-library/react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import type { EventTimeline, MatrixEvent, Room } from 'matrix-js-sdk';
import { RoomEvent, RelationType } from 'matrix-js-sdk';
import { createEventEmitterRoom } from '../timelineTestHelpers';
import type { Timeline } from '../timelineState';
import { createTimelineWindow, getWindowRange } from '../utils/timelineWindow';
import { useLiveTimelineUpdates } from './useLiveTimelineUpdates';

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
  isLatestMessageBottomVisible: boolean;
  unfocusedAutoScroll: boolean;
  totalEvents: number;
  pinToLatestMessageBottom: () => void;
  onState: (timeline: Timeline) => void;
};

function Harness({
  room,
  isLatestMessageBottomVisible,
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
  const isLatestMessageBottomVisibleRef = useRef(isLatestMessageBottomVisible);
  isLatestMessageBottomVisibleRef.current = isLatestMessageBottomVisible;
  useLiveTimelineUpdates({
    room,
    setTimeline,
    scrollRef,
    checkIsLatestMessageBottomVisible: () => isLatestMessageBottomVisibleRef.current,
    pinToLatestMessageBottom,
    unfocusedAutoScroll,
  });
  onState(timeline);
  return null;
}

type Setup = Partial<
  Pick<HarnessProps, 'isLatestMessageBottomVisible' | 'unfocusedAutoScroll' | 'totalEvents'>
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
      isLatestMessageBottomVisible={overrides.isLatestMessageBottomVisible ?? false}
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
    const { room, pinToLatestMessageBottom, state } = setup({ isLatestMessageBottomVisible: true });
    emit(room, reaction());
    expect(derivedRange(state.current)).toEqual(INITIAL_RANGE);
    expect(pinToLatestMessageBottom).not.toHaveBeenCalled();
  });

  it('anchors the range to the live edge and pins live when following live while focused', () => {
    const totalEvents = INITIAL_RANGE.newest + 1;
    const { room, pinToLatestMessageBottom, state } = setup({
      isLatestMessageBottomVisible: true,
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

  it('anchors the range to the live edge when at the bottom of the live window', () => {
    const totalEvents = INITIAL_RANGE.newest + 1;
    const { room, pinToLatestMessageBottom, state } = setup({
      isLatestMessageBottomVisible: true,
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

  it('does not shift the range when at the bottom of a window that is behind the live edge', () => {
    const { room, pinToLatestMessageBottom, state } = setup({
      isLatestMessageBottomVisible: false,
      focused: true,
      totalEvents: INITIAL_RANGE.newest + 1,
    });
    emit(room, liveMessage());
    expect(derivedRange(state.current)).toEqual(INITIAL_RANGE);
    expect(pinToLatestMessageBottom).not.toHaveBeenCalled();
  });

  it('does not shift the range when the newest message is out of view', () => {
    const { room, pinToLatestMessageBottom, state } = setup({
      isLatestMessageBottomVisible: false,
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
      isLatestMessageBottomVisible: true,
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

  it('anchors the range to the live edge while unfocused when unfocusedAutoScroll is on', () => {
    const totalEvents = INITIAL_RANGE.newest + 1;
    const { room, pinToLatestMessageBottom, state } = setup({
      isLatestMessageBottomVisible: true,
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
