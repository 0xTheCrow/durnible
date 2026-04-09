import React from 'react';
import { EventTimelineSet, MatrixEvent, Relations } from 'matrix-js-sdk';
import { Box, Chip, Icon, Icons, Text, config, color, toRem } from 'folds';
import { useTranslation } from 'react-i18next';
import {
  Reply,
  MessageUnsupportedContent,
  Time,
  MessageNotDecryptedContent,
  RedactedContent,
  MSticker,
  ImageContent,
  EventContent,
  MPoll,
  LinePlaceholder,
} from '../../components/message';
import {
  getEditedEvent,
  getMemberDisplayName,
  isMembershipChanged,
} from '../../utils/room';
import { MessageEvent, StateEvent } from '../../../types/matrix/room';
import { MessageLayout } from '../../state/settings';
import { getMxIdLocalPart } from '../../utils/matrix';
import { RenderMessageContent } from '../../components/RenderMessageContent';
import { Image } from '../../components/media';
import { Reactions, Message, Event, EncryptedContent } from './message';
import * as customHtmlCss from '../../styles/CustomHtml.css';
import { useMemberEventParser } from '../../hooks/useMemberEventParser';
import { useTimelineMessageContext } from './TimelineMessageContext';

const warningStyle = { color: color.Warning.Main, opacity: config.opacity.P300 };

function DecryptRetry({
  retrying,
  onRetry,
}: {
  retrying: boolean;
  onRetry: () => void;
}) {
  return (
    <Text>
      <Box as="span" alignItems="Center" gap="200" style={warningStyle}>
        <Icon size="50" src={Icons.Lock} />
        <i>Unable to decrypt message</i>
        <Chip
          as="button"
          radii="300"
          variant="SurfaceVariant"
          size="400"
          disabled={retrying}
          onClick={onRetry}
        >
          <Text size="T200">{retrying ? 'Retrying…' : 'Retry'}</Text>
        </Chip>
      </Box>
    </Text>
  );
}

type MemoizedTimelineEventProps = {
  mEvent: MatrixEvent;
  mEventId: string;
  timelineSet: EventTimelineSet;
  item: number;
  collapsed: boolean;
  isHighlighted: boolean;
  isEditing: boolean;
  // Passed from parent so the comparator can detect the undefined→Relations
  // transition (first reaction added) and trigger a re-render to mount Reactions.
  // Subsequent reaction changes are handled internally by useRelations.
  reactionRelations: Relations | undefined;
  // Passed from parent so edits and redactions (invisible events that don't
  // change range deps) still trigger a re-render via the comparator.
  editedEvent: MatrixEvent | undefined;
  isRedacted: boolean;
  // Passed from parent so local-echo status changes (QUEUED→SENDING→sent/failed)
  // trigger a re-render. mEvent.status mutates in-place; the reference stays
  // the same so without this prop the memo would bail out and Message would
  // remain faded (isPending=true) until an unrelated event arrived.
  eventStatus: MatrixEvent['status'];
};

function TimelineEventComponent({
  mEvent,
  mEventId,
  timelineSet,
  item,
  collapsed,
  isHighlighted,
  isEditing: isEditingProp,
  reactionRelations,
  editedEvent,
  isRedacted,
}: MemoizedTimelineEventProps) {
  const ctx = useTimelineMessageContext();
  const parseMemberEvent = useMemberEventParser();
  const { t } = useTranslation();

  const {
    room,
    mx,
    messageLayout,
    messageSpacing,
    mediaAutoLoad,
    showUrlPreview,
    canRedact,
    canSendReaction,
    canPinEvent,
    imagePackRooms,
    getMemberPowerTag,
    accessiblePowerTagColors,
    legacyUsernameColor,
    direct,
    hideReadReceipts,
    showDeveloperTools,
    hour24Clock,
    dateFormatString,
    htmlReactParserOptions,
    linkifyOpts,
    replyHighlight,
    showHiddenEvents,
    hideMembershipEvents,
    hideNickAvatarEvents,
    handleUserClick,
    handleUsernameClick,
    handleReplyClick,
    handleReactionToggle,
    editId: contextEditId,
    handleEdit,
    handleOpenReply,
    handleDecryptRetry,
  } = ctx;

  // Derive isEditing from context's editId directly. This bypasses the memo
  // comparator (context changes always trigger re-renders) and eliminates any
  // race between setEditId and the prop flowing through the comparator.
  const isEditing = isEditingProp || contextEditId === mEventId;

  const eventType = mEvent.getType();
  const isStateEvent = typeof mEvent.getStateKey() === 'string';
  const canDelete = canRedact || mEvent.getSender() === mx.getUserId();

  // When hidden events are off, redacted messages should disappear entirely.
  // buildTimelineItems filters these out on rebuild, but since redactions are
  // invisible events (no range change → no rebuild), we need to gate here too.
  if (isRedacted && !showHiddenEvents) return null;
  const myUserId = mx.getSafeUserId();

  // ─── Message-type events (RoomMessage, RoomMessageEncrypted, Sticker, PollStart) ───

  if (
    eventType === MessageEvent.RoomMessage ||
    eventType === MessageEvent.RoomMessageEncrypted ||
    eventType === MessageEvent.Sticker ||
    eventType === MessageEvent.PollStart ||
    eventType === 'm.poll.start'
  ) {
    const reactions = reactionRelations && reactionRelations.getSortedAnnotationsByKey();
    const hasReactions = reactions && reactions.length > 0;
    const { replyEventId, threadRootId } = mEvent;
    const replyToMe =
      !!replyEventId && timelineSet.findEventById(replyEventId)?.getSender() === myUserId;
    const senderId = mEvent.getSender() ?? '';

    const replyJSX = replyEventId ? (
      <Reply
        room={room}
        timelineSet={timelineSet}
        replyEventId={replyEventId}
        threadRootId={threadRootId}
        onClick={handleOpenReply}
        getMemberPowerTag={getMemberPowerTag}
        accessibleTagColors={accessiblePowerTagColors}
        legacyUsernameColor={legacyUsernameColor || direct}
      />
    ) : undefined;

    const reactionsJSX = reactionRelations ? (
      <Reactions
        style={{ marginTop: config.space.S200 }}
        room={room}
        relations={reactionRelations}
        mEventId={mEventId}
        canSendReaction={canSendReaction}
        onReactionToggle={handleReactionToggle}
      />
    ) : undefined;

    const baseMessageProps = {
      'data-message-item': item,
      'data-message-id': mEventId,
      room,
      mEvent,
      messageSpacing,
      messageLayout,
      collapse: collapsed,
      highlight: isHighlighted,
      canDelete,
      canSendReaction,
      canPinEvent,
      imagePackRooms,
      relations: hasReactions ? reactionRelations : undefined,
      onUserClick: handleUserClick,
      onUsernameClick: handleUsernameClick,
      onReplyClick: handleReplyClick,
      onReactionToggle: handleReactionToggle,
      reply: replyJSX,
      reactions: reactionsJSX,
      hideReadReceipts,
      showDeveloperTools,
      memberPowerTag: getMemberPowerTag(senderId),
      accessibleTagColors: accessiblePowerTagColors,
      legacyUsernameColor: legacyUsernameColor || direct,
      hour24Clock,
      dateFormatString,
    };

    if (eventType === MessageEvent.RoomMessage) {
      const content = editedEvent?.getContent()['m.new_content'] ?? mEvent.getContent();
      const senderDisplayName =
        getMemberDisplayName(room, senderId) ?? getMxIdLocalPart(senderId) ?? senderId;
      const mentionedMe =
        (mEvent.getContent()['m.mentions']?.user_ids as string[] | undefined)?.includes(
          myUserId
        ) ?? false;

      return (
        <Message
          {...baseMessageProps}
          mentionHighlight={replyHighlight && (replyToMe || mentionedMe)}
          edit={isEditing}
          onEditId={handleEdit}
        >
          {isRedacted ? (
            <RedactedContent reason={mEvent.getUnsigned().redacted_because?.content.reason} />
          ) : (
            <RenderMessageContent
              displayName={senderDisplayName}
              msgType={mEvent.getContent().msgtype ?? ''}
              edited={!!editedEvent}
              content={content}
              mediaAutoLoad={mediaAutoLoad}
              urlPreview={showUrlPreview}
              htmlReactParserOptions={htmlReactParserOptions}
              linkifyOpts={linkifyOpts}
              outlineAttachment={messageLayout === MessageLayout.Bubble}
            />
          )}
        </Message>
      );
    }

    if (eventType === MessageEvent.RoomMessageEncrypted) {
      const mentionedMe =
        (mEvent.getContent()['m.mentions']?.user_ids as string[] | undefined)?.includes(
          myUserId
        ) ?? false;

      return (
        <Message
          {...baseMessageProps}
          mentionHighlight={replyHighlight && (replyToMe || mentionedMe)}
          edit={isEditing}
          onEditId={handleEdit}
        >
          <EncryptedContent mEvent={mEvent}>
            {(retrying, setRetrying) => {
              if (mEvent.isRedacted()) return showHiddenEvents ? <RedactedContent /> : null;
              if (mEvent.getType() === MessageEvent.Sticker)
                return (
                  <MSticker
                    content={mEvent.getContent()}
                    renderImageContent={(props) => (
                      <ImageContent
                        {...props}
                        autoPlay={mediaAutoLoad}
                        renderImage={(p) => <Image {...p} loading="lazy" />}
                      />
                    )}
                  />
                );
              if (mEvent.getType() === MessageEvent.RoomMessage) {
                const editedEvt = getEditedEvent(mEventId, mEvent, timelineSet);
                const content =
                  editedEvt?.getContent()['m.new_content'] ?? mEvent.getContent();

                if (content.msgtype === 'm.bad.encrypted') {
                  return (
                    <DecryptRetry
                      retrying={retrying}
                      onRetry={async () => {
                        setRetrying(true);
                        await handleDecryptRetry();
                        setRetrying(false);
                      }}
                    />
                  );
                }

                const decryptedSenderId = mEvent.getSender() ?? '';
                const senderDisplayName =
                  getMemberDisplayName(room, decryptedSenderId) ??
                  getMxIdLocalPart(decryptedSenderId) ??
                  decryptedSenderId;
                return (
                  <RenderMessageContent
                    displayName={senderDisplayName}
                    msgType={mEvent.getContent().msgtype ?? ''}
                    edited={!!editedEvt}
                    content={content}
                    mediaAutoLoad={mediaAutoLoad}
                    urlPreview={showUrlPreview}
                    htmlReactParserOptions={htmlReactParserOptions}
                    linkifyOpts={linkifyOpts}
                    outlineAttachment={messageLayout === MessageLayout.Bubble}
                  />
                );
              }
              if (
                mEvent.getType() === MessageEvent.PollStart ||
                mEvent.getType() === 'm.poll.start'
              )
                return <MPoll mEvent={mEvent} timelineSet={timelineSet} mx={mx} />;
              if (mEvent.getType() === MessageEvent.RoomMessageEncrypted) {
                return (
                  <LinePlaceholder
                    style={{
                      backgroundColor: color.SurfaceVariant.ContainerActive,
                      maxWidth: toRem(400),
                    }}
                  />
                );
              }
              return (
                <Text>
                  <MessageUnsupportedContent />
                </Text>
              );
            }}
          </EncryptedContent>
        </Message>
      );
    }

    if (eventType === MessageEvent.Sticker) {
      return (
        <Message {...baseMessageProps} mentionHighlight={replyHighlight && replyToMe}>
          {isRedacted ? (
            <RedactedContent reason={mEvent.getUnsigned().redacted_because?.content.reason} />
          ) : (
            <MSticker
              content={mEvent.getContent()}
              renderImageContent={(props) => (
                <ImageContent
                  {...props}
                  autoPlay={mediaAutoLoad}
                  renderImage={(p) => <Image {...p} loading="lazy" />}
                />
              )}
            />
          )}
        </Message>
      );
    }

    // PollStart / m.poll.start
    return (
      <Message {...baseMessageProps}>
        {isRedacted ? (
          <RedactedContent reason={mEvent.getUnsigned().redacted_because?.content.reason} />
        ) : (
          <MPoll mEvent={mEvent} timelineSet={timelineSet} mx={mx} />
        )}
      </Message>
    );
  }

  // ─── State events ───

  const baseEventProps = {
    'data-message-item': item,
    'data-message-id': mEventId,
    room,
    mEvent,
    highlight: isHighlighted,
    messageSpacing,
    canDelete,
    hideReadReceipts,
    showDeveloperTools,
  };

  const timeJSX = (
    <Time
      ts={mEvent.getTs()}
      compact={messageLayout === MessageLayout.Compact}
      hour24Clock={hour24Clock}
      dateFormatString={dateFormatString}
    />
  );

  if (eventType === StateEvent.RoomMember) {
    const membershipChanged = isMembershipChanged(mEvent);
    if (membershipChanged && hideMembershipEvents) return null;
    if (!membershipChanged && hideNickAvatarEvents) return null;

    const parsed = parseMemberEvent(mEvent);

    return (
      <Event {...baseEventProps}>
        <EventContent
          messageLayout={messageLayout}
          time={timeJSX}
          iconSrc={parsed.icon}
          content={
            <Box grow="Yes" direction="Column">
              <Text size="T300" priority="300">
                {parsed.body}
              </Text>
            </Box>
          }
        />
      </Event>
    );
  }

  const roomPropertyLabels: Record<string, string> = {
    [StateEvent.RoomName]: t('Organisms.RoomCommon.changed_room_name'),
    [StateEvent.RoomTopic]: ' changed room topic',
    [StateEvent.RoomAvatar]: ' changed room avatar',
  };

  if (eventType in roomPropertyLabels) {
    const senderId = mEvent.getSender() ?? '';
    const senderName = getMemberDisplayName(room, senderId) || getMxIdLocalPart(senderId);

    return (
      <Event {...baseEventProps}>
        <EventContent
          messageLayout={messageLayout}
          time={timeJSX}
          iconSrc={Icons.Hash}
          content={
            <Box grow="Yes" direction="Column">
              <Text size="T300" priority="300">
                <b>{senderName}</b>
                {roomPropertyLabels[eventType]}
              </Text>
            </Box>
          }
        />
      </Event>
    );
  }

  // ─── Fallback renderers (showHiddenEvents only) ───

  if (!showHiddenEvents) return null;

  const senderId = mEvent.getSender() ?? '';
  const senderName = getMemberDisplayName(room, senderId) || getMxIdLocalPart(senderId);

  if (isStateEvent) {
    return (
      <Event {...baseEventProps}>
        <EventContent
          messageLayout={messageLayout}
          time={timeJSX}
          iconSrc={Icons.Code}
          content={
            <Box grow="Yes" direction="Column">
              <Text size="T300" priority="300">
                <b>{senderName}</b>
                {' sent '}
                <code className={customHtmlCss.Code}>{mEvent.getType()}</code>
                {' state event'}
              </Text>
            </Box>
          }
        />
      </Event>
    );
  }

  if (Object.keys(mEvent.getContent()).length === 0) return null;
  if (mEvent.getRelation()) return null;
  if (mEvent.isRedaction()) return null;

  return (
    <Event {...baseEventProps}>
      <EventContent
        messageLayout={messageLayout}
        time={timeJSX}
        iconSrc={Icons.Code}
        content={
          <Box grow="Yes" direction="Column">
            <Text size="T300" priority="300">
              <b>{senderName}</b>
              {' sent '}
              <code className={customHtmlCss.Code}>{mEvent.getType()}</code>
              {' event'}
            </Text>
          </Box>
        }
      />
    </Event>
  );
}

export const MemoizedTimelineEvent = React.memo(
  TimelineEventComponent,
  (prev, next) => {
    const result =
      prev.mEventId === next.mEventId &&
      prev.item === next.item &&
      prev.collapsed === next.collapsed &&
      prev.isHighlighted === next.isHighlighted &&
      prev.isEditing === next.isEditing &&
      // Detects the undefined→Relations transition (first reaction added/removed)
      // so the component re-renders and mounts/unmounts the Reactions child.
      // Subsequent reaction count changes are handled by useRelations internally.
      prev.reactionRelations === next.reactionRelations &&
      // Detects edits and redactions (invisible events that don't change range deps).
      // getEditedEvent returns a new MatrixEvent ref when an edit arrives;
      // isRedacted flips to true when a redaction arrives.
      prev.editedEvent === next.editedEvent &&
      prev.isRedacted === next.isRedacted &&
      // Detects local-echo status transitions (QUEUED→SENDING→null/NOT_SENT).
      // mEvent.status mutates in-place so the reference doesn't change;
      // without this guard the faded opacity would persist until an unrelated event.
      prev.eventStatus === next.eventStatus;
    return result;
  }
);
