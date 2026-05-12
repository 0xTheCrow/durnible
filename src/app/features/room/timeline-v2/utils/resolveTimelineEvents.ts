import type { EventTimeline, EventTimelineSet, MatrixEvent } from 'matrix-js-sdk';
import {
  getTimelineAndBaseIndex,
  getTimelineEvent,
  getTimelineRelativeIndex,
} from '../../timeline/timelineUtils';

export type ResolvedTimelineEvent = {
  mEvent: MatrixEvent;
  mEventId: string;
  timelineSet: EventTimelineSet;
  item: number;
};

export const resolveTimelineEvents = (
  linkedTimelines: EventTimeline[],
  items: number[],
  willRender: (mEvent: MatrixEvent) => boolean
): ResolvedTimelineEvent[] => {
  const events: ResolvedTimelineEvent[] = [];
  for (const item of items) {
    const [eventTimeline, baseIndex] = getTimelineAndBaseIndex(linkedTimelines, item);
    if (!eventTimeline) continue;
    const mEvent = getTimelineEvent(eventTimeline, getTimelineRelativeIndex(item, baseIndex));
    if (!mEvent) continue;
    const mEventId = mEvent.getId();
    if (!mEventId) continue;
    if (!willRender(mEvent)) continue;
    events.push({
      mEvent,
      mEventId,
      timelineSet: eventTimeline.getTimelineSet(),
      item,
    });
  }
  return events;
};
