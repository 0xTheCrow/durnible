import type { ComponentProps } from 'react';
import React from 'react';
import type { Room } from 'matrix-js-sdk';
import { Avatar, AvatarFallback, AvatarImage, Text } from 'folds';
import { useMatrixClient } from '../../hooks/useMatrixClient';
import { useMediaAuthentication } from '../../hooks/useMediaAuthentication';
import { getMemberAvatarMxc, getMemberDisplayName } from '../../utils/room';
import { mxcUrlToHttp } from '../../utils/matrix';
import { nameInitials } from '../../utils/common';
import colorMXID from '../../../util/colorMXID';

type CallMemberAvatarProps = {
  room: Room;
  userId: string;
  size: ComponentProps<typeof Avatar>['size'];
  textSize: ComponentProps<typeof Text>['size'];
};
export function CallMemberAvatar({ room, userId, size, textSize }: CallMemberAvatarProps) {
  const mx = useMatrixClient();
  const useAuthentication = useMediaAuthentication();
  const displayName = getMemberDisplayName(room, userId) ?? userId;
  const avatarMxc = getMemberAvatarMxc(room, userId);
  const avatarUrl = avatarMxc
    ? mxcUrlToHttp(mx, avatarMxc, useAuthentication, 96, 96, 'crop') ?? undefined
    : undefined;

  return (
    <Avatar size={size} radii="Pill">
      {avatarUrl ? (
        <AvatarImage src={avatarUrl} alt={displayName} />
      ) : (
        <AvatarFallback style={{ backgroundColor: colorMXID(userId) }}>
          <Text as="span" size={textSize}>
            {nameInitials(displayName)}
          </Text>
        </AvatarFallback>
      )}
    </Avatar>
  );
}
