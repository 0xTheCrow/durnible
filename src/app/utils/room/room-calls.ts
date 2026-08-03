import type { MatrixEvent, Room } from 'matrix-js-sdk';
import { JoinRule, RestrictedAllowType } from 'matrix-js-sdk';
import type { RoomJoinRulesEventContent } from 'matrix-js-sdk/lib/types';
import type { RoomToParents } from '../../../types/matrix/room';
import { Membership, StateEvent } from '../../../types/matrix/room';
import { getStateEvent, getStateEvents } from './state';

const checkIsValidParent = (mEvent: MatrixEvent): boolean =>
  Array.isArray(mEvent.getContent<{ via: string[] }>().via);

const checkIsRestrictedToSpaceMembership = (room: Room): boolean => {
  const joinRules = getStateEvent(
    room,
    StateEvent.RoomJoinRules
  )?.getContent<RoomJoinRulesEventContent>();

  const allow = joinRules?.allow;
  if (!Array.isArray(allow)) return false;

  return allow.some((entry) => entry?.type === RestrictedAllowType.RoomMembership);
};

export type CallRoomAccess = {
  membership: Membership | undefined;
  joinRule: string | undefined;
  isParentSpaceMember: boolean;
};

export const checkIsCallRoomEnterable = ({
  membership,
  joinRule,
  isParentSpaceMember,
}: CallRoomAccess): boolean => {
  if (membership === Membership.Join || membership === Membership.Invite) return true;
  if (membership === Membership.Ban) return false;

  if (joinRule === JoinRule.Public) return true;
  if (joinRule === JoinRule.Restricted || joinRule === 'knock_restricted') {
    return isParentSpaceMember;
  }

  return false;
};

export const checkIsRoomCallAllowed = (
  room: Room,
  mDirects: Set<string>,
  roomToParents: RoomToParents
): boolean => {
  if (mDirects.has(room.roomId)) return true;

  if (getStateEvents(room, StateEvent.SpaceParent).some(checkIsValidParent)) return false;

  if (checkIsRestrictedToSpaceMembership(room)) return false;

  return !roomToParents.has(room.roomId);
};
