import type { EventTimeline, EventTimelineSet, MatrixEvent } from 'matrix-js-sdk';
import {
  getTimelineAndBaseIndex,
  getTimelineEvent,
  getTimelineRelativeIndex,
} from '../timelineUtils';

export type ResolvedTimelineEvent = {
  mEvent: MatrixEvent;
  mEventId: string;
  timelineSet: EventTimelineSet;
  item: number;
};

export type ResolvedTimeline = {
  events: ResolvedTimelineEvent[];
  firstUnreadEventId: string | undefined;
};

export const resolveTimelineEvents = (
  linkedTimelines: EventTimeline[],
  items: number[],
  willRender: (mEvent: MatrixEvent) => boolean,
  readUptoEventId: string | undefined,
  myUserId: string
): ResolvedTimeline => {
  const events: ResolvedTimelineEvent[] = [];
  let firstUnreadEventId: string | undefined;
  let passedReadUpto = false;
  for (const item of items) {
    const [eventTimeline, baseIndex] = getTimelineAndBaseIndex(linkedTimelines, item);
    if (!eventTimeline) continue;
    const mEvent = getTimelineEvent(eventTimeline, getTimelineRelativeIndex(item, baseIndex));
    if (!mEvent) continue;
    const mEventId = mEvent.getId();
    if (!mEventId) continue;
    if (willRender(mEvent)) {
      if (passedReadUpto && !firstUnreadEventId && mEvent.getSender() !== myUserId) {
        firstUnreadEventId = mEventId;
      }
      events.push({
        mEvent,
        mEventId,
        timelineSet: eventTimeline.getTimelineSet(),
        item,
      });
    }
    if (mEventId === readUptoEventId) passedReadUpto = true;
  }
  return { events, firstUnreadEventId };
};
