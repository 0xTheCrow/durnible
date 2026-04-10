import type { EventTimelineSet, MatrixEvent } from 'matrix-js-sdk';
import { reactionOrEditEvent } from './room';
import { inSameDay, minuteDifference } from './time';

export type TimelineEventInput = {
  mEvent: MatrixEvent;
  mEventId: string;
  timelineSet: EventTimelineSet;
  item: number;
};

export type TimelineItem =
  | {
      type: 'event';
      key: string;
      item: number;
      mEventId: string;
      mEvent: MatrixEvent;
      timelineSet: EventTimelineSet;
      collapsed: boolean;
    }
  | { type: 'new-messages'; key: string }
  | { type: 'day-divider'; key: string; ts: number };

/**
 * Converts a pre-filtered list of timeline events into a flat list of
 * renderable descriptors, inserting day-divider and new-messages divider
 * items at the correct positions.
 *
 * Pre-filtering (ignored users, hidden redacted events) is the caller's
 * responsibility. This function only handles the descriptor logic.
 *
 * @param events       - Ordered, pre-filtered timeline events.
 * @param readUptoEventId - ID of the last event the user has read.
 *                         The "New Messages" divider appears before the
 *                         first rendered event that follows it.
 * @param myUserId     - Current user's ID. Messages from this user do not
 *                       trigger the "New Messages" divider.
 * @param willRender   - Predicate that returns true if an event will produce
 *                       visible output. Non-rendered events are invisible and
 *                       transparent to divider placement and collapse grouping.
 */
export function buildTimelineDescriptors(
  events: TimelineEventInput[],
  readUptoEventId: string | undefined,
  myUserId: string,
  willRender: (mEvent: MatrixEvent) => boolean = (mEvent) => !reactionOrEditEvent(mEvent)
): TimelineItem[] {
  const result: TimelineItem[] = [];
  // Only track the last *rendered* event. Non-rendered events (reactions,
  // redactions, hidden state events) are invisible and must not affect divider
  // placement or collapse grouping — otherwise removing a reaction causes a
  // one-frame collapse-state flip that looks like a flicker.
  let prevRenderedEvent: MatrixEvent | undefined;
  let newDividerPending = false;
  let dayDividerPending = false;

  for (const { mEvent, mEventId, timelineSet, item } of events) {
    const eventSender = mEvent.getSender();

    if (!newDividerPending && readUptoEventId) {
      newDividerPending = prevRenderedEvent?.getId() === readUptoEventId;
    }
    if (!dayDividerPending) {
      dayDividerPending = prevRenderedEvent
        ? !inSameDay(prevRenderedEvent.getTs(), mEvent.getTs())
        : false;
    }

    const collapsed =
      !dayDividerPending &&
      (!newDividerPending || eventSender === myUserId) &&
      prevRenderedEvent !== undefined &&
      prevRenderedEvent.getSender() === eventSender &&
      prevRenderedEvent.getType() === mEvent.getType() &&
      minuteDifference(prevRenderedEvent.getTs(), mEvent.getTs()) < 2;

    const renders = willRender(mEvent);

    if (renders) {
      if (newDividerPending && eventSender !== myUserId) {
        result.push({ type: 'new-messages', key: `new-messages-before-${mEventId}` });
        newDividerPending = false;
      }
      if (dayDividerPending) {
        result.push({
          type: 'day-divider',
          key: `day-divider-before-${mEventId}`,
          ts: mEvent.getTs(),
        });
        dayDividerPending = false;
      }
      result.push({ type: 'event', key: mEventId, item, mEventId, mEvent, timelineSet, collapsed });
      prevRenderedEvent = mEvent;
    }
  }

  return result;
}
