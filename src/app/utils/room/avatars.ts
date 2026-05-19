import type { IconName, IconSrc } from 'folds';
import type { MatrixClient, Room } from 'matrix-js-sdk';
import { JoinRule } from 'matrix-js-sdk';

export const joinRuleToIconSrc = (
  icons: Record<IconName, IconSrc>,
  joinRule: JoinRule,
  space: boolean
): IconSrc | undefined => {
  if (joinRule === JoinRule.Restricted) {
    return space ? icons.Space : icons.Hash;
  }
  if (joinRule === JoinRule.Knock) {
    return space ? icons.SpaceLock : icons.HashLock;
  }
  if (joinRule === JoinRule.Invite) {
    return space ? icons.SpaceLock : icons.HashLock;
  }
  if (joinRule === JoinRule.Public) {
    return space ? icons.SpaceGlobe : icons.HashGlobe;
  }
  return undefined;
};

export const getRoomAvatarUrl = (
  mx: MatrixClient,
  room: Room,
  size: 32 | 96 = 32,
  useAuthentication = false
): string | undefined => {
  const mxcUrl = room.getMxcAvatarUrl();
  return mxcUrl
    ? mx.mxcUrlToHttp(mxcUrl, size, size, 'crop', undefined, false, useAuthentication) ?? undefined
    : undefined;
};

export const getDirectRoomAvatarUrl = (
  mx: MatrixClient,
  room: Room,
  size: 32 | 96 = 32,
  useAuthentication = false
): string | undefined => {
  const mxcUrl = room.getAvatarFallbackMember()?.getMxcAvatarUrl();

  if (!mxcUrl) {
    return getRoomAvatarUrl(mx, room, size, useAuthentication);
  }

  return (
    mx.mxcUrlToHttp(mxcUrl, size, size, 'crop', undefined, false, useAuthentication) ?? undefined
  );
};
