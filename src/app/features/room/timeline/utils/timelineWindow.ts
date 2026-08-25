import type { EventTimeline } from 'matrix-js-sdk';
import type { TimelineRange, TimelineWindow } from '../timelineState';
import {
  getTimelineAndBaseIndex,
  getTimelineEvent,
  getTimelineRelativeIndex,
  getTimelinesEventsCount,
} from '../timelineUtils';

export const getEventIdAtIndex = (
  linkedTimelines: EventTimeline[],
  absoluteIndex: number
): string | undefined => {
  const [timeline, baseIndex] = getTimelineAndBaseIndex(linkedTimelines, absoluteIndex);
  if (!timeline) return undefined;
  return getTimelineEvent(timeline, getTimelineRelativeIndex(absoluteIndex, baseIndex))?.getId();
};

export const resolveWindowStartIndex = (
  linkedTimelines: EventTimeline[],
  startEventId: string | undefined,
  hintIndex?: number
): number | undefined => {
  if (startEventId === undefined) return undefined;
  if (hintIndex !== undefined && getEventIdAtIndex(linkedTimelines, hintIndex) === startEventId) {
    return hintIndex;
  }
  let baseIndex = 0;
  for (let timelineIndex = 0; timelineIndex < linkedTimelines.length; timelineIndex += 1) {
    const events = linkedTimelines[timelineIndex].getEvents();
    for (let eventIndex = 0; eventIndex < events.length; eventIndex += 1) {
      if (events[eventIndex].getId() === startEventId) return baseIndex + eventIndex;
    }
    baseIndex += events.length;
  }
  return undefined;
};

export const createTimelineWindow = (
  linkedTimelines: EventTimeline[],
  oldest: number,
  newest: number
): TimelineWindow => ({
  startEventId: getEventIdAtIndex(linkedTimelines, oldest),
  size: newest - oldest,
});

export const getWindowRange = (
  linkedTimelines: EventTimeline[],
  timelineWindow: TimelineWindow,
  hintIndex?: number
): TimelineRange => {
  const eventsCount = getTimelinesEventsCount(linkedTimelines);
  const startIndex = resolveWindowStartIndex(
    linkedTimelines,
    timelineWindow.startEventId,
    hintIndex
  );
  const oldest = startIndex ?? Math.max(0, eventsCount - timelineWindow.size);
  return { oldest, newest: Math.min(oldest + timelineWindow.size, eventsCount) };
};
