import type { MatrixEvent } from 'matrix-js-sdk';
import { isMembershipChanged, reactionOrEditEvent } from '../../utils/room';
import { MessageEvent, StateEvent } from '../../../types/matrix/room';

export type WillEventRenderSettings = {
  showHiddenEvents: boolean;
  hideMembershipEvents: boolean;
  hideNickAvatarEvents: boolean;
};

export const willEventRender = (
  mEvent: MatrixEvent,
  { showHiddenEvents, hideMembershipEvents, hideNickAvatarEvents }: WillEventRenderSettings
): boolean => {
  if (reactionOrEditEvent(mEvent)) return false;
  if (!showHiddenEvents) {
    if (mEvent.isRedaction()) return false;
    const type = mEvent.getType();
    const isRegistered =
      type === MessageEvent.RoomMessage ||
      type === MessageEvent.RoomMessageEncrypted ||
      type === MessageEvent.Sticker ||
      type === MessageEvent.PollStart ||
      type === 'm.poll.start' ||
      type === StateEvent.RoomMember ||
      type === StateEvent.RoomName ||
      type === StateEvent.RoomTopic ||
      type === StateEvent.RoomAvatar;
    if (!isRegistered) return false;
  }
  if (mEvent.getType() === StateEvent.RoomMember) {
    const membershipChanged = isMembershipChanged(mEvent);
    if (membershipChanged && hideMembershipEvents) return false;
    if (!membershipChanged && hideNickAvatarEvents) return false;
  }
  return true;
};
