import type { MouseEventHandler } from 'react';
import React, { useState } from 'react';
import type { Room } from 'matrix-js-sdk';
import type { RectCords } from 'folds';
import {
  Avatar,
  Box,
  Icon,
  IconButton,
  Icons,
  PopOut,
  Spinner,
  Text,
  Tooltip,
  TooltipProvider,
  config,
  toRem,
} from 'folds';
import FocusTrap from 'focus-trap-react';
import { useFocusWithin, useHover } from 'react-aria';
import { NavItem, NavItemContent, NavItemOptions, NavButton } from '../../components/nav';
import { useActiveCallParticipantIds } from '../../hooks/call/useActiveCallParticipantIds';
import type { CallParticipantAudioState } from '../../hooks/call/useCallParticipantAudioStates';
import { useCallParticipantAudioStates } from '../../hooks/call/useCallParticipantAudioStates';
import { useVoiceRoomEntry } from '../call/useVoiceRoomEntry';
import { CallMemberAvatar } from '../call/CallMemberAvatar';
import { useCallUserVolumeMenu } from '../call/useCallUserVolumeMenu';
import { useCallUserIsMuted } from '../../state/hooks/callVolumePreferences';
import { getMemberDisplayName } from '../../utils/room';
import { stopPropagation } from '../../utils/keyboard';
import { RoomNavItemMenu } from './RoomNavItem';

type VoiceParticipantProps = {
  room: Room;
  userId: string;
  audioState?: CallParticipantAudioState;
};
function VoiceParticipant({ room, userId, audioState }: VoiceParticipantProps) {
  const displayName = getMemberDisplayName(room, userId) ?? userId;
  const isMutedLocally = useCallUserIsMuted(userId);
  const { handleContextMenu, volumeMenu } = useCallUserVolumeMenu(userId, displayName);

  return (
    <>
      <Box as="span" alignItems="Center" gap="200" onContextMenu={handleContextMenu}>
        <CallMemberAvatar room={room} userId={userId} size="200" textSize="O400" />
        <Text as="span" size="T200" truncate>
          {displayName}
        </Text>
        {isMutedLocally && <Icon size="50" src={Icons.VolumeMute} filled />}
        {audioState === 'muted' && <Icon size="50" src={Icons.MicMute} filled />}
        {audioState === 'deafened' && <Icon size="50" src={Icons.Headphone} filled />}
      </Box>
      {volumeMenu}
    </>
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
  const participantAudioStates = useCallParticipantAudioStates(room);
  const { entryState, enterVoiceRoom } = useVoiceRoomEntry(room);
  const isConnected = entryState.status === 'connected';
  const [hover, setHover] = useState(false);
  const { hoverProps } = useHover({ onHoverChange: setHover });
  const { focusWithinProps } = useFocusWithin({ onFocusWithinChange: setHover });
  const [menuAnchor, setMenuAnchor] = useState<RectCords>();

  const handleContextMenu: MouseEventHandler<HTMLElement> = (evt) => {
    evt.preventDefault();
    setMenuAnchor({
      x: evt.clientX,
      y: evt.clientY,
      width: 0,
      height: 0,
    });
  };

  const handleOpenMenu: MouseEventHandler<HTMLButtonElement> = (evt) => {
    setMenuAnchor(evt.currentTarget.getBoundingClientRect());
  };

  const optionsVisible = hover || !!menuAnchor;

  return (
    <Box direction="Column">
      <NavItem
        variant="Background"
        radii="400"
        aria-selected={selected || isConnected}
        data-hover={!!menuAnchor}
        onContextMenu={isDrawerMode ? undefined : handleContextMenu}
        style={isDrawerMode || tall ? { minHeight: toRem(48) } : undefined}
        {...hoverProps}
        {...focusWithinProps}
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
        {optionsVisible && !isDrawerMode && (
          <NavItemOptions>
            <PopOut
              anchor={menuAnchor}
              offset={menuAnchor?.width === 0 ? 0 : undefined}
              alignOffset={menuAnchor?.width === 0 ? 0 : -5}
              position="Bottom"
              align={menuAnchor?.width === 0 ? 'Start' : 'End'}
              content={
                <FocusTrap
                  focusTrapOptions={{
                    initialFocus: false,
                    returnFocusOnDeactivate: false,
                    onDeactivate: () => setMenuAnchor(undefined),
                    clickOutsideDeactivates: true,
                    isKeyForward: (evt: KeyboardEvent) => evt.key === 'ArrowDown',
                    isKeyBackward: (evt: KeyboardEvent) => evt.key === 'ArrowUp',
                    escapeDeactivates: stopPropagation,
                  }}
                >
                  <RoomNavItemMenu room={room} onClose={() => setMenuAnchor(undefined)} />
                </FocusTrap>
              }
            >
              <IconButton
                onClick={handleOpenMenu}
                aria-pressed={!!menuAnchor}
                variant="Background"
                fill="None"
                size="300"
                radii="300"
              >
                <Icon size="50" src={Icons.VerticalDots} />
              </IconButton>
            </PopOut>
          </NavItemOptions>
        )}
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
            <VoiceParticipant
              key={userId}
              room={room}
              userId={userId}
              audioState={participantAudioStates.get(userId)}
            />
          ))}
        </Box>
      )}
    </Box>
  );
}
