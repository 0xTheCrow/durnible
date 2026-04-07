import { EventTimelineSet, MatrixEvent } from 'matrix-js-sdk';
import { reactionOrEditEvent } from './room';
import { inSameDay, minuteDifference } from './time';

export type TimelineEventInput = {
  mEvent: MatrixEvent;
  mEventId: string;
  timelineSet: EventTimelineSet;
  item: number;
};

export type TimelineItem =
  | { type: 'event'; key: string; item: number; mEventId: string; mEvent: MatrixEvent; timelineSet: EventTimelineSet; collapsed: boolean }
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
 */
export function buildTimelineDescriptors(
  events: TimelineEventInput[],
  readUptoEventId: string | undefined,
  myUserId: string,
  willRender: (mEvent: MatrixEvent) => boolean = (mEvent) => !reactionOrEditEvent(mEvent),
): TimelineItem[] {
  const result: TimelineItem[] = [];
  let prevEvent: MatrixEvent | undefined;
  let prevRenderedEvent: MatrixEvent | undefined;
  let isPrevRendered = false;
  let newDividerPending = false;
  let dayDividerPending = false;

  for (const { mEvent, mEventId, timelineSet, item } of events) {
    const eventSender = mEvent.getSender();

    if (!newDividerPending && readUptoEventId) {
      // Use prevRenderedEvent (not prevEvent) so that invisible events like
      // reactions don't shift the divider position.
      newDividerPending = prevRenderedEvent?.getId() === readUptoEventId;
    }
    if (!dayDividerPending) {
      dayDividerPending = prevEvent ? !inSameDay(prevEvent.getTs(), mEvent.getTs()) : false;
    }

    const collapsed =
      isPrevRendered &&
      !dayDividerPending &&
      (!newDividerPending || eventSender === myUserId) &&
      prevEvent !== undefined &&
      prevEvent.getSender() === eventSender &&
      prevEvent.getType() === mEvent.getType() &&
      minuteDifference(prevEvent.getTs(), mEvent.getTs()) < 2;

    const renders = willRender(mEvent);

    if (renders) {
      if (newDividerPending && eventSender !== myUserId) {
        result.push({ type: 'new-messages', key: `new-messages-before-${mEventId}` });
        newDividerPending = false;
      }
      if (dayDividerPending) {
        result.push({ type: 'day-divider', key: `day-divider-before-${mEventId}`, ts: mEvent.getTs() });
        dayDividerPending = false;
      }
      result.push({ type: 'event', key: mEventId, item, mEventId, mEvent, timelineSet, collapsed });
      prevRenderedEvent = mEvent;
    }

    prevEvent = mEvent;
    isPrevRendered = renders;
  }

  return result;
}
