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
import { inSameDay } from './time';

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
// arrived or an absorbed image was redacted out of the group). Descriptor
// building produces a fresh array each render, so a plain `===` would
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
