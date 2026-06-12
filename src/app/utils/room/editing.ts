import type {
  EventTimeline,
  EventTimelineSet,
  IMentions,
  MatrixClient,
  MatrixEvent,
  Room,
} from 'matrix-js-sdk';
import { EventType, MsgType, RelationType } from 'matrix-js-sdk';
import type { ReactionEventContent } from 'matrix-js-sdk/lib/types';
import type { CryptoBackend } from 'matrix-js-sdk/lib/common-crypto/CryptoBackend';
import { MessageEvent } from '../../../types/matrix/room';
import { MATRIX_REACTION_BUCKET_CREATED_AT_PROPERTY_NAME } from '../../../types/matrix/common';

export const decryptEvents = async (mx: MatrixClient, events: MatrixEvent[]) => {
  const crypto = mx.getCrypto();
  if (!crypto) return;
  const decryptionPromises = events
    .filter((event) => event.isEncrypted() && !event.isRedacted())
    .reverse()
    .map((event) => event.attemptDecryption(crypto as CryptoBackend, { isRetry: true }));
  await Promise.allSettled(decryptionPromises);
};

export const decryptAllTimelineEvent = (mx: MatrixClient, timeline: EventTimeline) =>
  decryptEvents(mx, timeline.getEvents());

export const getReactionContent = (
  eventId: string,
  key: string,
  shortcode?: string,
  bucketCreatedAt?: number
): ReactionEventContent & {
  shortcode?: string;
  [MATRIX_REACTION_BUCKET_CREATED_AT_PROPERTY_NAME]?: number;
} => ({
  'm.relates_to': {
    event_id: eventId,
    key,
    rel_type: RelationType.Annotation,
  },
  shortcode,
  ...(bucketCreatedAt !== undefined
    ? { [MATRIX_REACTION_BUCKET_CREATED_AT_PROPERTY_NAME]: bucketCreatedAt }
    : {}),
});

export const getReactionBucketCreatedAt = (reactionEvent: MatrixEvent): number => {
  const stamped = reactionEvent.getContent()[MATRIX_REACTION_BUCKET_CREATED_AT_PROPERTY_NAME];
  return typeof stamped === 'number' ? stamped : reactionEvent.getTs();
};

export const sortReactionBuckets = (
  reactionEvents: MatrixEvent[]
): [string, Set<MatrixEvent>][] => {
  const keyMap = reactionEvents.reduce((map, reactionEvent) => {
    const key = reactionEvent.getRelation()?.key;
    if (typeof key !== 'string') return map;
    const existing = map.get(key) ?? new Set<MatrixEvent>();
    existing.add(reactionEvent);
    map.set(key, existing);
    return map;
  }, new Map<string, Set<MatrixEvent>>());

  return Array.from(keyMap.entries())
    .map(([key, events]) => {
      let earliestCreatedAt = Infinity;
      let earliestEventId = '';
      events.forEach((reactionEvent) => {
        const createdAt = getReactionBucketCreatedAt(reactionEvent);
        const eventId = reactionEvent.getId() ?? '';
        if (
          createdAt < earliestCreatedAt ||
          (createdAt === earliestCreatedAt && eventId < earliestEventId)
        ) {
          earliestCreatedAt = createdAt;
          earliestEventId = eventId;
        }
      });
      return { key, events, earliestCreatedAt, earliestEventId };
    })
    .sort((a, b) => {
      if (a.earliestCreatedAt !== b.earliestCreatedAt) {
        return a.earliestCreatedAt - b.earliestCreatedAt;
      }
      if (a.earliestEventId === b.earliestEventId) return 0;
      return a.earliestEventId < b.earliestEventId ? -1 : 1;
    })
    .map((bucket): [string, Set<MatrixEvent>] => [bucket.key, bucket.events]);
};

export const computeReactionBucketCreatedAt = (
  room: Room,
  targetEventId: string,
  key: string
): number | undefined => {
  let earliest: number | undefined;
  room
    .getUnfilteredTimelineSet()
    .getTimelines()
    .forEach((timeline) => {
      timeline.getEvents().forEach((reactionEvent) => {
        if (reactionEvent.getType() !== EventType.Reaction || reactionEvent.isRedacted()) return;
        const relation = reactionEvent.getRelation();
        if (
          relation?.event_id !== targetEventId ||
          relation?.rel_type !== RelationType.Annotation ||
          relation?.key !== key
        )
          return;
        const createdAt = getReactionBucketCreatedAt(reactionEvent);
        if (earliest === undefined || createdAt < earliest) earliest = createdAt;
      });
    });
  return earliest;
};

export const getEventReactions = (timelineSet: EventTimelineSet, eventId: string) =>
  timelineSet.relations.getChildEventsForEvent(
    eventId,
    RelationType.Annotation,
    EventType.Reaction
  );

export const getEventEdits = (timelineSet: EventTimelineSet, eventId: string, eventType: string) =>
  timelineSet.relations.getChildEventsForEvent(eventId, RelationType.Replace, eventType);

export const getLatestEdit = (
  targetEvent: MatrixEvent,
  editEvents: MatrixEvent[]
): MatrixEvent | undefined => {
  const eventByTargetSender = (rEvent: MatrixEvent) =>
    rEvent.getSender() === targetEvent.getSender();
  return editEvents.sort((m1, m2) => m2.getTs() - m1.getTs()).find(eventByTargetSender);
};

export const getEditedEvent = (
  mEventId: string,
  mEvent: MatrixEvent,
  timelineSet: EventTimelineSet
): MatrixEvent | undefined => {
  const edits = getEventEdits(timelineSet, mEventId, mEvent.getType());
  return edits && getLatestEdit(mEvent, edits.getRelations());
};

export const canEditEvent = (mx: MatrixClient, mEvent: MatrixEvent) => {
  const content = mEvent.getContent();
  const relationType = content['m.relates_to']?.rel_type;
  return (
    mEvent.getSender() === mx.getUserId() &&
    (!relationType || relationType === RelationType.Thread) &&
    mEvent.getType() === MessageEvent.RoomMessage &&
    (content.msgtype === MsgType.Text ||
      content.msgtype === MsgType.Emote ||
      content.msgtype === MsgType.Notice)
  );
};

export const getLatestEditableEvt = (
  timeline: EventTimeline,
  canEdit: (mEvent: MatrixEvent) => boolean
): MatrixEvent | undefined => {
  const events = timeline.getEvents();

  for (let i = events.length - 1; i >= 0; i -= 1) {
    const evt = events[i];
    if (canEdit(evt)) return evt;
  }
  return undefined;
};

export const reactionOrEditEvent = (mEvent: MatrixEvent) => {
  const relType = mEvent.getRelation()?.rel_type;
  if (relType === RelationType.Annotation || relType === RelationType.Replace) return true;
  if (relType === RelationType.Reference) {
    const evtType = mEvent.getType();
    if (
      evtType === MessageEvent.PollResponse ||
      evtType === 'org.matrix.msc3381.poll.response' ||
      evtType === 'm.poll.response' ||
      evtType === MessageEvent.PollEnd ||
      evtType === 'org.matrix.msc3381.poll.end' ||
      evtType === 'm.poll.end'
    ) {
      return true;
    }
  }
  return false;
};

export const isModifierTimelineEvent = (mEvent: MatrixEvent) =>
  reactionOrEditEvent(mEvent) || mEvent.isRedaction();

export const getPollResponses = (timelineSet: EventTimelineSet, eventId: string) =>
  timelineSet.relations.getChildEventsForEvent(
    eventId,
    RelationType.Reference,
    MessageEvent.PollResponse
  ) ??
  timelineSet.relations.getChildEventsForEvent(eventId, RelationType.Reference, 'm.poll.response');

export const getPollEndEvents = (timelineSet: EventTimelineSet, eventId: string) =>
  timelineSet.relations.getChildEventsForEvent(
    eventId,
    RelationType.Reference,
    MessageEvent.PollEnd
  ) ?? timelineSet.relations.getChildEventsForEvent(eventId, RelationType.Reference, 'm.poll.end');

export const getMentionContent = (userIds: string[], room: boolean): IMentions => {
  const mMentions: IMentions = {};
  if (userIds.length > 0) {
    mMentions.user_ids = userIds;
  }
  if (room) {
    mMentions.room = true;
  }

  return mMentions;
};
