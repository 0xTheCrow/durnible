import React from 'react';
import type { Room } from 'matrix-js-sdk';
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
  Box,
  Icon,
  Icons,
  Spinner,
  Text,
  Tooltip,
  TooltipProvider,
  config,
  toRem,
} from 'folds';
import { NavItem, NavItemContent, NavButton } from '../../components/nav';
import { useMatrixClient } from '../../hooks/useMatrixClient';
import { useMediaAuthentication } from '../../hooks/useMediaAuthentication';
import { useActiveCallParticipantIds } from '../../hooks/call/useActiveCallParticipantIds';
import { useVoiceRoomEntry } from '../call/useVoiceRoomEntry';
import { getMemberAvatarMxc, getMemberDisplayName } from '../../utils/room';
import { mxcUrlToHttp } from '../../utils/matrix';
import { nameInitials } from '../../utils/common';
import colorMXID from '../../../util/colorMXID';

type VoiceParticipantProps = {
  room: Room;
  userId: string;
};
function VoiceParticipant({ room, userId }: VoiceParticipantProps) {
  const mx = useMatrixClient();
  const useAuthentication = useMediaAuthentication();
  const displayName = getMemberDisplayName(room, userId) ?? userId;
  const avatarMxc = getMemberAvatarMxc(room, userId);
  const avatarUrl = avatarMxc
    ? mxcUrlToHttp(mx, avatarMxc, useAuthentication, 96, 96, 'crop') ?? undefined
    : undefined;

  return (
    <Box as="span" alignItems="Center" gap="200">
      <Avatar size="200" radii="Pill">
        {avatarUrl ? (
          <AvatarImage src={avatarUrl} alt={displayName} />
        ) : (
          <AvatarFallback style={{ backgroundColor: colorMXID(userId) }}>
            <Text as="span" size="O400">
              {nameInitials(displayName)}
            </Text>
          </AvatarFallback>
        )}
      </Avatar>
      <Text as="span" size="T200" truncate>
        {displayName}
      </Text>
    </Box>
  );
}

type RoomNavVoiceItemProps = {
  room: Room;
  selected: boolean;
  isDrawerMode?: boolean;
  tall?: boolean;
};
export function RoomNavVoiceItem({ room, selected, isDrawerMode, tall }: RoomNavVoiceItemProps) {
  const participantIds = useActiveCallParticipantIds(room);
  const { entryState, enterVoiceRoom } = useVoiceRoomEntry(room);
  const isConnected = entryState.status === 'connected';

  return (
    <Box direction="Column">
      <NavItem
        variant="Background"
        radii="400"
        aria-selected={selected || isConnected}
        style={isDrawerMode || tall ? { minHeight: toRem(48) } : undefined}
      >
        <NavButton type="button" onClick={enterVoiceRoom}>
          <NavItemContent>
            <Box as="span" grow="Yes" alignItems="Center" gap="200">
              <Avatar size="200" radii="400">
                {entryState.status === 'connecting' ? (
                  <Spinner size="100" variant="Secondary" />
                ) : (
                  <Icon src={Icons.VolumeHigh} size="100" filled={isConnected} />
                )}
              </Avatar>
              <Box as="span" grow="Yes">
                <Text as="span" size="Inherit" truncate>
                  {room.name}
                </Text>
              </Box>
              {entryState.status === 'failed' && (
                <TooltipProvider
                  tooltip={
                    <Tooltip variant="Critical" style={{ maxWidth: toRem(200) }}>
                      <Text style={{ wordBreak: 'break-word' }} size="T300">
                        {entryState.error.message}
                      </Text>
                    </Tooltip>
                  }
                >
                  {(triggerRef) => (
                    <Icon
                      ref={triggerRef}
                      src={Icons.Warning}
                      size="100"
                      filled
                      aria-label={entryState.error.message}
                    />
                  )}
                </TooltipProvider>
              )}
            </Box>
          </NavItemContent>
        </NavButton>
      </NavItem>
      {participantIds.length > 0 && (
        <Box
          direction="Column"
          gap="100"
          style={{
            paddingLeft: toRem(40),
            paddingBottom: config.space.S100,
            paddingTop: config.space.S100,
          }}
        >
          {participantIds.map((userId) => (
            <VoiceParticipant key={userId} room={room} userId={userId} />
          ))}
        </Box>
      )}
    </Box>
  );
}
