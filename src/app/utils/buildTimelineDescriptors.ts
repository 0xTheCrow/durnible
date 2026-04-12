import { MsgType } from 'matrix-js-sdk';
import type { EventTimelineSet, MatrixEvent } from 'matrix-js-sdk';
import type { IImageContent } from '../../types/matrix/common';
import { MessageEvent } from '../../types/matrix/room';
import { reactionOrEditEvent } from './room';
import { inSameDay, minuteDifference } from './time';

/**
 * Maximum time gap (ms) between two consecutive image messages from the same
 * sender that still allows them to be merged into a single image-grid message.
 */
export const IMAGE_GROUP_WINDOW_MS = 10 * 1000;

/**
 * Maximum number of images that can be merged into a single image-grid
 * message (3 wide x 2 tall).
 */
export const IMAGE_GROUP_MAX_SIZE = 6;

const isPlainImageEvent = (mEvent: MatrixEvent): boolean => {
  if (mEvent.getType() !== MessageEvent.RoomMessage) return false;
  if (mEvent.isRedacted()) return false;
  const content = mEvent.getContent();
  if (content.msgtype !== MsgType.Image) return false;
  const url = content.url ?? content.file?.url;
  return typeof url === 'string';
};

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
      /**
       * When set, this event is the anchor of an image group and the array
       * contains the image contents of every event in the group (including
       * the anchor's own content) in chronological order. The anchor renders
       * the entire grid; the other events in the group are filtered out of
       * the timeline output.
       */
      groupedImages?: IImageContent[];
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
  // ─── Pre-pass: detect image groups ─────────────────────────────────────────
  // Walk the events once and identify runs of consecutive image messages from
  // the same sender within IMAGE_GROUP_WINDOW_MS of each other (using the
  // previous image's timestamp as the rolling reference). Each group is keyed
  // by its anchor mEventId; the absorbed events are skipped by the main loop.
  const imageGroups = new Map<string, IImageContent[]>();
  const absorbedToAnchor = new Map<string, string>();

  for (let i = 0; i < events.length; i += 1) {
    const anchor = events[i];
    if (absorbedToAnchor.has(anchor.mEventId)) continue;
    if (!willRender(anchor.mEvent)) continue;
    if (!isPlainImageEvent(anchor.mEvent)) continue;

    const groupContents: IImageContent[] = [anchor.mEvent.getContent() as IImageContent];
    const groupIds: string[] = [];
    let lastTs = anchor.mEvent.getTs();
    const sender = anchor.mEvent.getSender();

    for (let j = i + 1; j < events.length && groupContents.length < IMAGE_GROUP_MAX_SIZE; j += 1) {
      const next = events[j];
      // Skip invisible events (reactions, edits) — they don't break a run.
      if (!willRender(next.mEvent)) continue;
      if (!isPlainImageEvent(next.mEvent)) break;
      if (next.mEvent.getSender() !== sender) break;
      const nextTs = next.mEvent.getTs();
      if (nextTs - lastTs > IMAGE_GROUP_WINDOW_MS) break;
      // Don't merge images that span a day boundary — the day-divider would
      // otherwise be hidden inside the group.
      if (!inSameDay(lastTs, nextTs)) break;
      groupContents.push(next.mEvent.getContent() as IImageContent);
      groupIds.push(next.mEventId);
      lastTs = nextTs;
    }

    if (groupContents.length > 1) {
      imageGroups.set(anchor.mEventId, groupContents);
      groupIds.forEach((id) => absorbedToAnchor.set(id, anchor.mEventId));
    }
  }

  // If readUpto points to an absorbed image, redirect it to that group's
  // anchor — reading any image in a group means the user has seen the whole
  // grid, so the new-messages divider should fire after the anchor.
  const effectiveReadUptoEventId =
    readUptoEventId && absorbedToAnchor.has(readUptoEventId)
      ? absorbedToAnchor.get(readUptoEventId)
      : readUptoEventId;

  // ─── Main pass: emit dividers and event descriptors ───────────────────────
  const result: TimelineItem[] = [];
  // Only track the last *rendered* event. Non-rendered events (reactions,
  // redactions, hidden state events) are invisible and must not affect divider
  // placement or collapse grouping — otherwise removing a reaction causes a
  // one-frame collapse-state flip that looks like a flicker.
  let prevRenderedEvent: MatrixEvent | undefined;
  let newDividerPending = false;
  let dayDividerPending = false;

  for (const { mEvent, mEventId, timelineSet, item } of events) {
    // Absorbed images are folded into their anchor and must be invisible to
    // divider placement and collapse grouping.
    if (absorbedToAnchor.has(mEventId)) continue;

    const eventSender = mEvent.getSender();

    if (!newDividerPending && effectiveReadUptoEventId) {
      newDividerPending = prevRenderedEvent?.getId() === effectiveReadUptoEventId;
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
      const groupedImages = imageGroups.get(mEventId);
      result.push({
        type: 'event',
        key: mEventId,
        item,
        mEventId,
        mEvent,
        timelineSet,
        collapsed,
        groupedImages,
      });
      prevRenderedEvent = mEvent;
    }
  }

  return result;
}
