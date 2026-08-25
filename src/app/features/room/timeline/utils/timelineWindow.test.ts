import { describe, it, expect } from 'vitest';
import type { EventTimeline, MatrixEvent } from 'matrix-js-sdk';
import type { TimelineRange } from '../timelineState';
import {
  getTimelineAndBaseIndex,
  getTimelineEvent,
  getTimelineRelativeIndex,
} from '../timelineUtils';
import { createTimelineWindow, getWindowRange } from './timelineWindow';

const createEvent = (eventId: string): MatrixEvent =>
  ({ getId: () => eventId } as unknown as MatrixEvent);

type MutableTimeline = {
  timeline: EventTimeline;
  prepend: (eventIds: string[]) => void;
  append: (eventIds: string[]) => void;
  remove: (eventId: string) => void;
};

const createTimeline = (eventIds: string[]): MutableTimeline => {
  const events = eventIds.map(createEvent);
  return {
    timeline: { getEvents: () => events } as unknown as EventTimeline,
    prepend: (ids) => events.unshift(...ids.map(createEvent)),
    append: (ids) => events.push(...ids.map(createEvent)),
    remove: (eventId) => {
      const index = events.findIndex((event) => event.getId() === eventId);
      events.splice(index, 1);
    },
  };
};

const sequentialEventIds = (prefix: string, count: number): string[] =>
  Array.from({ length: count }, (_unused, index) => `$${prefix}${index}`);

const eventIdsInRange = (linkedTimelines: EventTimeline[], range: TimelineRange): string[] => {
  const eventIds: string[] = [];
  for (let index = range.oldest; index < range.newest; index += 1) {
    const [timeline, baseIndex] = getTimelineAndBaseIndex(linkedTimelines, index);
    if (timeline) {
      const event = getTimelineEvent(timeline, getTimelineRelativeIndex(index, baseIndex));
      if (event) eventIds.push(event.getId() as string);
    }
  }
  return eventIds;
};

describe('getWindowRange', () => {
  it('resolves to the same range when events are only appended', () => {
    const live = createTimeline(sequentialEventIds('old', 100));
    const linkedTimelines = [live.timeline];
    const timelineWindow = createTimelineWindow(linkedTimelines, 20, 100);
    const renderedEventIds = eventIdsInRange(linkedTimelines, { oldest: 20, newest: 100 });

    live.append(sequentialEventIds('new', 3));
    const range = getWindowRange(linkedTimelines, timelineWindow);

    expect(range).toEqual({ oldest: 20, newest: 100 });
    expect(eventIdsInRange(linkedTimelines, range)).toEqual(renderedEventIds);
  });

  it('follows the prepended count only, ignoring events appended in the same mutation', () => {
    const live = createTimeline(sequentialEventIds('old', 100));
    const linkedTimelines = [live.timeline];
    const timelineWindow = createTimelineWindow(linkedTimelines, 0, 100);
    const renderedEventIds = eventIdsInRange(linkedTimelines, { oldest: 0, newest: 100 });

    live.prepend(sequentialEventIds('back', 80));
    live.append(sequentialEventIds('new', 3));
    const range = getWindowRange(linkedTimelines, timelineWindow);

    expect(range).toEqual({ oldest: 80, newest: 180 });
    expect(eventIdsInRange(linkedTimelines, range)).toEqual(renderedEventIds);
  });

  it('follows the window when a new timeline is linked ahead of it', () => {
    const live = createTimeline(sequentialEventIds('old', 100));
    const linkedTimelines = [live.timeline];
    const timelineWindow = createTimelineWindow(linkedTimelines, 20, 100);
    const renderedEventIds = eventIdsInRange(linkedTimelines, { oldest: 20, newest: 100 });

    const earlier = createTimeline(sequentialEventIds('earlier', 40));
    const relinkedTimelines = [earlier.timeline, live.timeline];
    const range = getWindowRange(relinkedTimelines, timelineWindow);

    expect(range).toEqual({ oldest: 60, newest: 140 });
    expect(eventIdsInRange(relinkedTimelines, range)).toEqual(renderedEventIds);
  });

  it('ignores a stale hint index', () => {
    const live = createTimeline(sequentialEventIds('old', 100));
    const linkedTimelines = [live.timeline];
    const timelineWindow = createTimelineWindow(linkedTimelines, 20, 100);

    live.prepend(sequentialEventIds('back', 80));
    const range = getWindowRange(linkedTimelines, timelineWindow, 20);

    expect(range).toEqual({ oldest: 100, newest: 180 });
  });

  it('falls back to the newest events when the window start event is gone', () => {
    const live = createTimeline(sequentialEventIds('old', 100));
    const linkedTimelines = [live.timeline];
    const timelineWindow = createTimelineWindow(linkedTimelines, 20, 100);

    live.remove('$old20');
    const range = getWindowRange(linkedTimelines, timelineWindow);

    expect(range).toEqual({ oldest: 19, newest: 99 });
  });
});
