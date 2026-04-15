import type { MouseEventHandler, RefObject } from 'react';
import { useCallback } from 'react';
import type { IContent, MatrixClient, MatrixEvent, Room } from 'matrix-js-sdk';
import { EventType } from 'matrix-js-sdk';
import { ReactEditor } from 'slate-react';
import type { Editor } from 'slate';
import { useSetAtom } from 'jotai';
import { createMentionElement, moveCursor } from '../../components/editor';
import { eventWithShortcode, factoryEventSentBy, getMxIdLocalPart } from '../../utils/matrix';
import {
  getEditedEvent,
  getEventReactions,
  getMemberDisplayName,
  getReactionContent,
} from '../../utils/room';
import type { ReplyDraftAtom } from '../../state/room/roomInputDrafts';
import type { useOpenUserRoomProfile } from '../../state/hooks/userRoomProfile';

type OpenUserRoomProfile = ReturnType<typeof useOpenUserRoomProfile>;

export type TimelineClickHandlersDeps = {
  mx: MatrixClient;
  room: Room;
  spaceRoomId: string | undefined;
  openUserRoomProfile: OpenUserRoomProfile;
  editor: Editor;
  alternateInput: boolean;
  alternateInputRef: RefObject<HTMLDivElement>;
  replyDraftAtom: ReplyDraftAtom;
};

export type TimelineClickHandlers = {
  handleUserClick: MouseEventHandler<HTMLButtonElement>;
  handleUsernameClick: MouseEventHandler<HTMLButtonElement>;
  handleReplyClick: (
    ev: Parameters<MouseEventHandler<HTMLButtonElement>>[0],
    startThread?: boolean
  ) => void;
  handleReactionToggle: (targetEventId: string, key: string, shortcode?: string) => void;
};

export const useTimelineClickHandlers = ({
  mx,
  room,
  spaceRoomId,
  openUserRoomProfile,
  editor,
  alternateInput,
  alternateInputRef,
  replyDraftAtom,
}: TimelineClickHandlersDeps): TimelineClickHandlers => {
  const setReplyDraft = useSetAtom(replyDraftAtom);

  const handleUserClick: MouseEventHandler<HTMLButtonElement> = useCallback(
    (evt) => {
      evt.preventDefault();
      evt.stopPropagation();
      const userId = evt.currentTarget.getAttribute('data-user-id');
      if (!userId) {
        console.warn('Button should have "data-user-id" attribute!');
        return;
      }
      openUserRoomProfile(
        room.roomId,
        spaceRoomId,
        userId,
        evt.currentTarget.getBoundingClientRect()
      );
    },
    [room, spaceRoomId, openUserRoomProfile]
  );

  const handleUsernameClick: MouseEventHandler<HTMLButtonElement> = useCallback(
    (evt) => {
      evt.preventDefault();
      const userId = evt.currentTarget.getAttribute('data-user-id');
      if (!userId) {
        console.warn('Button should have "data-user-id" attribute!');
        return;
      }
      const name = getMemberDisplayName(room, userId) ?? getMxIdLocalPart(userId) ?? userId;
      if (alternateInput && editor.insertAlternateText) {
        editor.insertAlternateText(name.startsWith('@') ? name : `@${name}`);
      } else {
        editor.insertNode(
          createMentionElement(
            userId,
            name.startsWith('@') ? name : `@${name}`,
            userId === mx.getUserId()
          )
        );
        ReactEditor.focus(editor);
        moveCursor(editor);
      }
    },
    [mx, room, editor, alternateInput]
  );

  const handleReplyClick = useCallback(
    (evt: Parameters<MouseEventHandler<HTMLButtonElement>>[0], startThread = false) => {
      const replyId = evt.currentTarget.getAttribute('data-event-id');
      if (!replyId) {
        console.warn('Button should have "data-event-id" attribute!');
        return;
      }
      const replyEvt = room.findEventById(replyId);
      if (!replyEvt) return;
      const editedReply = getEditedEvent(replyId, replyEvt, room.getUnfilteredTimelineSet());
      const content: IContent = editedReply?.getContent()['m.new_content'] ?? replyEvt.getContent();
      const { body, formatted_body: formattedBody } = content;
      const { 'm.relates_to': relation } = startThread
        ? { 'm.relates_to': { rel_type: 'm.thread', event_id: replyId } }
        : replyEvt.getWireContent();
      const senderId = replyEvt.getSender();
      if (senderId && typeof body === 'string') {
        setReplyDraft({
          userId: senderId,
          eventId: replyId,
          body,
          formattedBody,
          relation,
        });
        if (alternateInput) {
          alternateInputRef.current?.focus();
        } else {
          ReactEditor.focus(editor);
        }
      }
    },
    [room, setReplyDraft, editor, alternateInput, alternateInputRef]
  );

  const handleReactionToggle = useCallback(
    (targetEventId: string, key: string, shortcode?: string) => {
      const relations = getEventReactions(room.getUnfilteredTimelineSet(), targetEventId);
      const allReactions = relations?.getSortedAnnotationsByKey() ?? [];
      const [, reactionsSet] = allReactions.find(([k]) => k === key) ?? [];
      const reactions: MatrixEvent[] = reactionsSet ? Array.from(reactionsSet) : [];
      const myReaction = reactions.find(factoryEventSentBy(mx.getSafeUserId()));

      if (myReaction && !!myReaction?.isRelation()) {
        const myReactionId = myReaction.getId();
        if (myReactionId) {
          mx.redactEvent(room.roomId, myReactionId);
        }
        return;
      }
      const rShortcode =
        shortcode ||
        (reactions.find(eventWithShortcode)?.getContent().shortcode as string | undefined);
      mx.sendEvent(
        room.roomId,
        EventType.Reaction,
        getReactionContent(targetEventId, key, rShortcode)
      );
    },
    [mx, room]
  );

  return {
    handleUserClick,
    handleUsernameClick,
    handleReplyClick,
    handleReactionToggle,
  };
};
