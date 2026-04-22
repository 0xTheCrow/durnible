import type {
  EventTimeline,
  EventTimelineSet,
  IMentions,
  MatrixClient,
  MatrixEvent,
} from 'matrix-js-sdk';
import { EventType, MsgType, RelationType } from 'matrix-js-sdk';
import type { ReactionEventContent } from 'matrix-js-sdk/lib/types';
import type { CryptoBackend } from 'matrix-js-sdk/lib/common-crypto/CryptoBackend';
import { MessageEvent } from '../../../types/matrix/room';

export const decryptAllTimelineEvent = async (mx: MatrixClient, timeline: EventTimeline) => {
  const crypto = mx.getCrypto();
  if (!crypto) return;
  const decryptionPromises = timeline
    .getEvents()
    .filter((event) => event.isEncrypted() && !event.isRedacted())
    .reverse()
    .map((event) => event.attemptDecryption(crypto as CryptoBackend, { isRetry: true }));
  await Promise.allSettled(decryptionPromises);
};

export const getReactionContent = (
  eventId: string,
  key: string,
  shortcode?: string
): ReactionEventContent & { shortcode?: string } => ({
  'm.relates_to': {
    event_id: eventId,
    key,
    rel_type: RelationType.Annotation,
  },
  shortcode,
});

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

export const isInvisibleTimelineEvent = (mEvent: MatrixEvent) =>
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
