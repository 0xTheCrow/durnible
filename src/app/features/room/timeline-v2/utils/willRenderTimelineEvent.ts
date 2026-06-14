import type { MatrixEvent } from 'matrix-js-sdk';
import { willEventRender } from '../../timeline/willEventRender';

export type WillRenderTimelineEventOptions = {
  ignoredUsersSet: Set<string>;
  showHiddenEvents: boolean;
  hideMembershipEvents: boolean;
  hideNickAvatarEvents: boolean;
};

export const willRenderTimelineEvent = (
  mEvent: MatrixEvent,
  {
    ignoredUsersSet,
    showHiddenEvents,
    hideMembershipEvents,
    hideNickAvatarEvents,
  }: WillRenderTimelineEventOptions
): boolean => {
  const sender = mEvent.getSender();
  if (sender && ignoredUsersSet.has(sender)) return false;
  if (mEvent.isRedacted() && !showHiddenEvents) return false;
  return willEventRender(mEvent, { showHiddenEvents, hideMembershipEvents, hideNickAvatarEvents });
};
