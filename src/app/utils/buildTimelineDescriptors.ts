import { MsgType } from 'matrix-js-sdk';
import type { EventTimelineSet, MatrixEvent } from 'matrix-js-sdk';
import type { ImageContent } from '../../types/matrix/common';
import {
  MATRIX_GALLERY_ID_PROPERTY_NAME,
  MATRIX_GALLERY_INDEX_PROPERTY_NAME,
  MATRIX_LEGACY_GALLERY_ID_PROPERTY_NAME,
  MATRIX_LEGACY_GALLERY_INDEX_PROPERTY_NAME,
} from '../../types/matrix/common';
import { GRID_MAX_CELLS } from '../components/message/imageGridLayout';
import { MessageEvent } from '../../types/matrix/room';
import { reactionOrEditEvent } from './room';
import { inSameDay, minuteDifference } from './time';

/**
 * Maximum number of images that can be merged into a single image-grid
 * message (3 wide x 2 tall).
 */
export const IMAGE_GROUP_MAX_SIZE = GRID_MAX_CELLS;

export const getGalleryId = (content: ImageContent): string | undefined =>
  content[MATRIX_GALLERY_ID_PROPERTY_NAME] ?? content[MATRIX_LEGACY_GALLERY_ID_PROPERTY_NAME];

export const getGalleryIndex = (content: ImageContent): number | undefined =>
  content[MATRIX_GALLERY_INDEX_PROPERTY_NAME] ?? content[MATRIX_LEGACY_GALLERY_INDEX_PROPERTY_NAME];

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
       * the anchor's own content) in batch_index order. The anchor renders
       * the entire grid; the other events in the group are filtered out of
       * the timeline output.
       */
      groupedImages?: ImageContent[];
      groupedEventIds?: string[];
    }
  | { type: 'new-messages'; key: string }
  | { type: 'day-divider'; key: string; ts: number };

export type ImageGroupsSnapshot = {
  imageGroups: Map<string, ImageContent[]>;
  groupEventIds: Map<string, string[]>;
  absorbedToAnchor: Map<string, string>;
};

// Element-wise identity check; ImageContent objects are stable per matrix-js-sdk
// event, so reference equality across the array detects both length changes
// (group grew/shrunk) and per-cell content reference changes (a new event
// arrived or an absorbed image was redacted out of the group). Each call to
// buildTimelineDescriptors produces a fresh array, so a plain `===` would
// always treat the prop as changed.
export const sameGroupedImages = (
  a: ImageContent[] | undefined,
  b: ImageContent[] | undefined
): boolean => {
  if (a === b) return true;
  if (!a || !b) return false;
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i += 1) {
    if (a[i] !== b[i]) return false;
  }
  return true;
};

export const computeImageGroups = (
  events: TimelineEventInput[],
  willRender: (mEvent: MatrixEvent) => boolean = (mEvent) => !reactionOrEditEvent(mEvent)
): ImageGroupsSnapshot => {
  const imageGroups = new Map<string, ImageContent[]>();
  const groupEventIds = new Map<string, string[]>();
  const absorbedToAnchor = new Map<string, string>();

  for (let i = 0; i < events.length; i += 1) {
    const anchor = events[i];
    if (absorbedToAnchor.has(anchor.mEventId)) continue;
    if (!willRender(anchor.mEvent)) continue;
    if (!isPlainImageEvent(anchor.mEvent)) continue;

    const anchorContent = anchor.mEvent.getContent() as ImageContent;
    const anchorGalleryId = getGalleryId(anchorContent);
    if (typeof anchorGalleryId !== 'string') continue;

    type GroupMember = { content: ImageContent; eventId: string };
    const members: GroupMember[] = [{ content: anchorContent, eventId: anchor.mEventId }];
    const absorbedIds: string[] = [];
    let lastTs = anchor.mEvent.getTs();
    const sender = anchor.mEvent.getSender();

    for (let j = i + 1; j < events.length && members.length < IMAGE_GROUP_MAX_SIZE; j += 1) {
      const next = events[j];
      // Invisible events (reactions, edits) don't break a run.
      if (!willRender(next.mEvent)) continue;
      if (!isPlainImageEvent(next.mEvent)) break;
      if (next.mEvent.getSender() !== sender) break;
      const nextTs = next.mEvent.getTs();
      // Day-boundary merges would hide the day-divider inside the group.
      if (!inSameDay(lastTs, nextTs)) break;
      const nextContent = next.mEvent.getContent() as ImageContent;
      if (getGalleryId(nextContent) !== anchorGalleryId) break;
      members.push({ content: nextContent, eventId: next.mEventId });
      absorbedIds.push(next.mEventId);
      lastTs = nextTs;
    }

    if (members.length > 1) {
      // Render order follows gallery_index, not timeline order — a homeserver
      // tie-break on identical origin_server_ts would otherwise scramble the grid.
      members.sort((a, b) => (getGalleryIndex(a.content) ?? 0) - (getGalleryIndex(b.content) ?? 0));
      imageGroups.set(
        anchor.mEventId,
        members.map((m) => m.content)
      );
      groupEventIds.set(
        anchor.mEventId,
        members.map((m) => m.eventId)
      );
      absorbedIds.forEach((id) => absorbedToAnchor.set(id, anchor.mEventId));
    }
  }

  return { imageGroups, groupEventIds, absorbedToAnchor };
};

const sameStringArray = (a: string[] | undefined, b: string[] | undefined): boolean => {
  if (a === b) return true;
  if (!a || !b) return false;
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i += 1) {
    if (a[i] !== b[i]) return false;
  }
  return true;
};

export const groupsEqual = (a: ImageGroupsSnapshot, b: ImageGroupsSnapshot): boolean => {
  if (a.imageGroups.size !== b.imageGroups.size) return false;
  if (a.groupEventIds.size !== b.groupEventIds.size) return false;
  if (a.absorbedToAnchor.size !== b.absorbedToAnchor.size) return false;
  for (const [k, v] of a.imageGroups) {
    if (!sameGroupedImages(v, b.imageGroups.get(k))) return false;
  }
  for (const [k, v] of a.groupEventIds) {
    if (!sameStringArray(v, b.groupEventIds.get(k))) return false;
  }
  for (const [k, v] of a.absorbedToAnchor) {
    if (b.absorbedToAnchor.get(k) !== v) return false;
  }
  return true;
};

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
  willRender?: (mEvent: MatrixEvent) => boolean,
  precomputedGroups?: ImageGroupsSnapshot
): TimelineItem[] {
  const effectiveWillRender = willRender ?? ((mEvent: MatrixEvent) => !reactionOrEditEvent(mEvent));
  const { imageGroups, groupEventIds, absorbedToAnchor } =
    precomputedGroups ?? computeImageGroups(events, effectiveWillRender);

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

    const renders = effectiveWillRender(mEvent);

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
      const groupedEventIds = groupEventIds.get(mEventId);
      result.push({
        type: 'event',
        key: mEventId,
        item,
        mEventId,
        mEvent,
        timelineSet,
        collapsed,
        groupedImages,
        groupedEventIds,
      });
      prevRenderedEvent = mEvent;
    }
  }

  return result;
}
