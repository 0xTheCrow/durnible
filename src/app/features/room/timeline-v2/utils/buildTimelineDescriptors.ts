import type { MatrixEvent } from 'matrix-js-sdk';
import {
  computeImageGroups,
  type TimelineEventInput,
  type TimelineItem,
} from '../../../../utils/buildTimelineDescriptors';
import { inSameDay, minuteDifference } from '../../../../utils/time';

export function buildTimelineDescriptors(
  events: TimelineEventInput[],
  firstUnreadEventId: string | undefined
): TimelineItem[] {
  const { imageGroups, groupEventIds, absorbedToAnchor } = computeImageGroups(events, () => true);

  const dividerBeforeEventId =
    firstUnreadEventId && absorbedToAnchor.has(firstUnreadEventId)
      ? absorbedToAnchor.get(firstUnreadEventId)
      : firstUnreadEventId;

  const result: TimelineItem[] = [];
  let prevEvent: MatrixEvent | undefined;
  let dayDividerPending = false;

  for (const { mEvent, mEventId, timelineSet, item } of events) {
    if (absorbedToAnchor.has(mEventId)) continue;

    const isFirstUnread = mEventId === dividerBeforeEventId;

    if (!dayDividerPending && prevEvent) {
      dayDividerPending = !inSameDay(prevEvent.getTs(), mEvent.getTs());
    }

    const collapsed =
      !dayDividerPending &&
      !isFirstUnread &&
      prevEvent !== undefined &&
      prevEvent.getSender() === mEvent.getSender() &&
      prevEvent.getType() === mEvent.getType() &&
      minuteDifference(prevEvent.getTs(), mEvent.getTs()) < 2;

    if (isFirstUnread) {
      result.push({ type: 'new-messages', key: `new-messages-before-${mEventId}` });
    }
    if (dayDividerPending) {
      result.push({
        type: 'day-divider',
        key: `day-divider-before-${mEventId}`,
        ts: mEvent.getTs(),
      });
      dayDividerPending = false;
    }
    result.push({
      type: 'event',
      key: mEventId,
      item,
      mEventId,
      mEvent,
      timelineSet,
      collapsed,
      groupedImages: imageGroups.get(mEventId),
      groupedEventIds: groupEventIds.get(mEventId),
    });
    prevEvent = mEvent;
  }

  return result;
}
