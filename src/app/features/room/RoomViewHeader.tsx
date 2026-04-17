import type { MouseEventHandler } from 'react';
import React, { forwardRef, useState } from 'react';
import FocusTrap from 'focus-trap-react';
import type { RectCords } from 'folds';
import {
  Box,
  Avatar,
  Text,
  IconButton,
  Icon,
  Icons,
  Tooltip,
  TooltipProvider,
  Menu,
  MenuItem,
  toRem,
  config,
  Line,
  PopOut,
  Badge,
  Spinner,
} from 'folds';
import { useNavigate } from 'react-router-dom';
import type { Room } from 'matrix-js-sdk';
import { JoinRule } from 'matrix-js-sdk';
import { useAtom, useAtomValue } from 'jotai';
import { OverlayModal } from '../../components/OverlayModal';

import { useStateEvent } from '../../hooks/useStateEvent';
import { PageHeader } from '../../components/page';
import { RoomAvatar, RoomIcon } from '../../components/room-avatar';
import { UseStateProvider } from '../../components/UseStateProvider';
import { RoomTopicViewer } from '../../components/room-topic-viewer';
import { StateEvent } from '../../../types/matrix/room';
import { useMatrixClient } from '../../hooks/useMatrixClient';
import { useRoom } from '../../hooks/useRoom';
import { useSetting } from '../../state/hooks/settings';
import { settingsAtom } from '../../state/settings';
import { useSpaceOptionally } from '../../hooks/useSpace';
import { getHomeSearchPath, getSpaceSearchPath, withSearchParam } from '../../pages/pathUtils';
import { getCanonicalAliasOrRoomId, isRoomAlias, mxcUrlToHttp } from '../../utils/matrix';
import type { _SearchPathSearchParams } from '../../pages/paths';
import * as css from './RoomViewHeader.css';
import { useRoomUnread } from '../../state/hooks/unread';
import { usePowerLevelsContext } from '../../hooks/usePowerLevels';
import { markAsRead } from '../../utils/notifications';
import { roomToUnreadAtom } from '../../state/room/roomToUnread';
import { copyToClipboard } from '../../utils/dom';
import { LeaveRoomPrompt } from '../../components/leave-room-prompt';
import { useRoomAvatar, useRoomName, useRoomTopic } from '../../hooks/useRoomMeta';
import { mDirectAtom } from '../../state/mDirectList';
import { ScreenSize, useScreenSizeContext } from '../../hooks/useScreenSize';
import { stopPropagation } from '../../utils/keyboard';
import { getMatrixToRoom } from '../../plugins/matrix-to';
import { getViaServers } from '../../plugins/via-servers';
import { BackRouteHandler } from '../../components/BackRouteHandler';
import { useMediaAuthentication } from '../../hooks/useMediaAuthentication';
import { useConnectionStatus } from '../../hooks/useConnectionStatus';
import { getConnectionStatusProps } from '../../pages/client/sidebar/SyncStatusTab';
import { useRoomPinnedEvents } from '../../hooks/useRoomPinnedEvents';
import { RoomPinMenu } from './room-pin-menu';
import { timelineSliderVisibleAtom } from './TimelineSlider';
import { useOpenRoomSettings } from '../../state/hooks/roomSettings';
import { RoomNotificationModeSwitcher } from '../../components/RoomNotificationSwitcher';
import {
  getRoomNotificationMode,
  getRoomNotificationModeIcon,
  useRoomsNotificationPreferencesContext,
} from '../../hooks/useRoomsNotificationPreferences';
import { JumpToTime } from './jump-to-time';
import { useRoomNavigate } from '../../hooks/useRoomNavigate';
import { useRoomCreators } from '../../hooks/useRoomCreators';
import { useRoomPermissions } from '../../hooks/useRoomPermissions';
import { InviteUserPrompt } from '../../components/invite-user-prompt';

type RoomMenuProps = {
  room: Room;
  onClose: () => void;
};
const RoomMenu = forwardRef<HTMLDivElement, RoomMenuProps>(({ room, onClose }, ref) => {
  const mx = useMatrixClient();
  const screenSize = useScreenSizeContext();
  const isMobile = screenSize === ScreenSize.Mobile;
  const [hideActivity] = useSetting(settingsAtom, 'hideActivity');
  const unread = useRoomUnread(room.roomId, roomToUnreadAtom);
  const powerLevels = usePowerLevelsContext();
  const creators = useRoomCreators(room);

  const permissions = useRoomPermissions(creators, powerLevels);
  const canInvite = permissions.action('invite', mx.getSafeUserId());
  const notificationPreferences = useRoomsNotificationPreferencesContext();
  const notificationMode = getRoomNotificationMode(notificationPreferences, room.roomId);
  const { navigateRoom } = useRoomNavigate();
  const pinnedEvents = useRoomPinnedEvents(room);
  const [pinMenuAnchor, setPinMenuAnchor] = useState<RectCords>();

  const [invitePrompt, setInvitePrompt] = useState(false);

  const handleMarkAsRead = () => {
    markAsRead(mx, room.roomId, hideActivity);
    onClose();
  };

  const handleInvite = () => {
    setInvitePrompt(true);
  };

  const handleCopyLink = () => {
    const roomIdOrAlias = getCanonicalAliasOrRoomId(mx, room.roomId);
    const viaServers = isRoomAlias(roomIdOrAlias) ? undefined : getViaServers(room);
    copyToClipboard(getMatrixToRoom(roomIdOrAlias, viaServers));
    onClose();
  };

  const openSettings = useOpenRoomSettings();
  const parentSpace = useSpaceOptionally();
  const handleOpenSettings = () => {
    openSettings(room.roomId, parentSpace?.roomId);
    onClose();
  };

  return (
    <Menu ref={ref} style={{ maxWidth: toRem(160), width: '100vw' }}>
      {invitePrompt && (
        <InviteUserPrompt
          room={room}
          onClose={() => {
            setInvitePrompt(false);
            onClose();
          }}
        />
      )}
      <Box direction="Column" gap="100" style={{ padding: config.space.S100 }}>
        <MenuItem
          onClick={handleMarkAsRead}
          size="300"
          after={<Icon size="100" src={Icons.CheckTwice} />}
          radii="300"
          disabled={!unread}
        >
          <Text style={{ flexGrow: 1 }} as="span" size="T300" truncate>
            Mark as Read
          </Text>
        </MenuItem>
        <RoomNotificationModeSwitcher roomId={room.roomId} value={notificationMode}>
          {(handleOpen, opened, changing) => (
            <MenuItem
              size="300"
              after={
                changing ? (
                  <Spinner size="100" variant="Secondary" />
                ) : (
                  <Icon size="100" src={getRoomNotificationModeIcon(notificationMode)} />
                )
              }
              radii="300"
              aria-pressed={opened}
              onClick={handleOpen}
            >
              <Text style={{ flexGrow: 1 }} as="span" size="T300" truncate>
                Notifications
              </Text>
            </MenuItem>
          )}
        </RoomNotificationModeSwitcher>
        {isMobile && (
          <>
            <MenuItem
              onClick={(evt: React.MouseEvent<HTMLButtonElement>) => {
                setPinMenuAnchor(evt.currentTarget.getBoundingClientRect());
              }}
              size="300"
              after={<Icon size="100" src={Icons.Pin} />}
              radii="300"
              aria-pressed={!!pinMenuAnchor}
            >
              <Text style={{ flexGrow: 1 }} as="span" size="T300" truncate>
                Pinned Messages{pinnedEvents.length > 0 ? ` (${pinnedEvents.length})` : ''}
              </Text>
            </MenuItem>
            <PopOut
              anchor={pinMenuAnchor}
              position="Bottom"
              content={
                <FocusTrap
                  focusTrapOptions={{
                    initialFocus: false,
                    returnFocusOnDeactivate: false,
                    onDeactivate: () => setPinMenuAnchor(undefined),
                    clickOutsideDeactivates: true,
                    isKeyForward: (evt: KeyboardEvent) => evt.key === 'ArrowDown',
                    isKeyBackward: (evt: KeyboardEvent) => evt.key === 'ArrowUp',
                    escapeDeactivates: stopPropagation,
                  }}
                >
                  <RoomPinMenu
                    room={room}
                    onClose={() => {
                      setPinMenuAnchor(undefined);
                      onClose();
                    }}
                  />
                </FocusTrap>
              }
            />
          </>
        )}
      </Box>
      <Line variant="Surface" size="300" />
      <Box direction="Column" gap="100" style={{ padding: config.space.S100 }}>
        <MenuItem
          onClick={handleInvite}
          variant="Primary"
          fill="None"
          size="300"
          after={<Icon size="100" src={Icons.UserPlus} />}
          radii="300"
          aria-pressed={invitePrompt}
          disabled={!canInvite}
        >
          <Text style={{ flexGrow: 1 }} as="span" size="T300" truncate>
            Invite
          </Text>
        </MenuItem>
        <MenuItem
          onClick={handleCopyLink}
          size="300"
          after={<Icon size="100" src={Icons.Link} />}
          radii="300"
        >
          <Text style={{ flexGrow: 1 }} as="span" size="T300" truncate>
            Copy Link
          </Text>
        </MenuItem>
        <MenuItem
          onClick={handleOpenSettings}
          size="300"
          after={<Icon size="100" src={Icons.Setting} />}
          radii="300"
        >
          <Text style={{ flexGrow: 1 }} as="span" size="T300" truncate>
            Room Settings
          </Text>
        </MenuItem>
        <UseStateProvider initial={false}>
          {(promptJump, setPromptJump) => (
            <>
              <MenuItem
                onClick={() => setPromptJump(true)}
                size="300"
                after={<Icon size="100" src={Icons.RecentClock} />}
                radii="300"
                aria-pressed={promptJump}
              >
                <Text style={{ flexGrow: 1 }} as="span" size="T300" truncate>
                  Jump to Time
                </Text>
              </MenuItem>
              {promptJump && (
                <JumpToTime
                  onSubmit={(eventId) => {
                    setPromptJump(false);
                    navigateRoom(room.roomId, eventId);
                    onClose();
                  }}
                  onCancel={() => setPromptJump(false)}
                />
              )}
            </>
          )}
        </UseStateProvider>
      </Box>
      <Line variant="Surface" size="300" />
      <Box direction="Column" gap="100" style={{ padding: config.space.S100 }}>
        <UseStateProvider initial={false}>
          {(promptLeave, setPromptLeave) => (
            <>
              <MenuItem
                onClick={() => setPromptLeave(true)}
                variant="Critical"
                fill="None"
                size="300"
                after={<Icon size="100" src={Icons.ArrowGoLeft} />}
                radii="300"
                aria-pressed={promptLeave}
              >
                <Text style={{ flexGrow: 1 }} as="span" size="T300" truncate>
                  Leave Room
                </Text>
              </MenuItem>
              {promptLeave && (
                <LeaveRoomPrompt
                  roomId={room.roomId}
                  onDone={onClose}
                  onCancel={() => setPromptLeave(false)}
                />
              )}
            </>
          )}
        </UseStateProvider>
      </Box>
    </Menu>
  );
});

export function RoomViewHeader() {
  const navigate = useNavigate();
  const mx = useMatrixClient();
  const useAuthentication = useMediaAuthentication();
  const screenSize = useScreenSizeContext();
  const room = useRoom();
  const space = useSpaceOptionally();
  const [menuAnchor, setMenuAnchor] = useState<RectCords>();
  const [pinMenuAnchor, setPinMenuAnchor] = useState<RectCords>();
  const mDirects = useAtomValue(mDirectAtom);

  const pinnedEvents = useRoomPinnedEvents(room);
  const encryptionEvent = useStateEvent(room, StateEvent.RoomEncryption);
  const ecryptedRoom = !!encryptionEvent;
  const avatarMxc = useRoomAvatar(room, mDirects.has(room.roomId));
  const name = useRoomName(room);
  const topic = useRoomTopic(room);
  const avatarUrl = avatarMxc
    ? mxcUrlToHttp(mx, avatarMxc, useAuthentication, 96, 96, 'crop') ?? undefined
    : undefined;

  const connectionStatus = useConnectionStatus();
  const connectionProps = getConnectionStatusProps(connectionStatus);

  const [peopleDrawer, setPeopleDrawer] = useSetting(settingsAtom, 'isPeopleDrawer');
  const [sliderVisible, setSliderVisible] = useAtom(timelineSliderVisibleAtom);

  const handleSearchClick = () => {
    const searchParams: _SearchPathSearchParams = {
      rooms: room.roomId,
    };
    const path = space
      ? getSpaceSearchPath(getCanonicalAliasOrRoomId(mx, space.roomId))
      : getHomeSearchPath();
    navigate(withSearchParam(path, searchParams));
  };

  const handleOpenMenu: MouseEventHandler<HTMLButtonElement> = (evt) => {
    setMenuAnchor(evt.currentTarget.getBoundingClientRect());
  };

  const handleOpenPinMenu: MouseEventHandler<HTMLButtonElement> = (evt) => {
    setPinMenuAnchor(evt.currentTarget.getBoundingClientRect());
  };

  return (
    <PageHeader balance={screenSize === ScreenSize.Mobile}>
      <Box grow="Yes" gap="300">
        {screenSize === ScreenSize.Mobile && (
          <BackRouteHandler>
            {(onBack) => (
              <Box shrink="No" alignItems="Center">
                <IconButton onClick={onBack}>
                  <Icon src={Icons.ArrowLeft} />
                </IconButton>
              </Box>
            )}
          </BackRouteHandler>
        )}
        <Box grow="Yes" alignItems="Center" gap="300">
          <Avatar size="300">
            {screenSize === ScreenSize.Mobile && connectionProps ? (
              <span
                style={{
                  color: connectionProps.iconColor,
                  lineHeight: 0,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: '100%',
                  height: '100%',
                  animation:
                    connectionStatus === 'connecting'
                      ? 'sync-pulse 2.5s ease-in-out infinite'
                      : undefined,
                }}
              >
                <Icon size="200" src={connectionProps.iconSrc} filled />
              </span>
            ) : (
              <RoomAvatar
                roomId={room.roomId}
                src={avatarUrl}
                alt={name}
                renderFallback={() => (
                  <RoomIcon
                    size="200"
                    joinRule={room.getJoinRule() ?? JoinRule.Restricted}
                    filled
                  />
                )}
              />
            )}
          </Avatar>
          <Box direction="Column">
            <Text size={topic ? 'H5' : 'H3'} truncate>
              {name}
            </Text>
            {topic && (
              <UseStateProvider initial={false}>
                {(viewTopic, setViewTopic) => (
                  <>
                    <OverlayModal open={viewTopic} onClose={() => setViewTopic(false)}>
                      <RoomTopicViewer
                        name={name}
                        topic={topic}
                        onClose={() => setViewTopic(false)}
                      />
                    </OverlayModal>
                    <Text
                      as="button"
                      type="button"
                      onClick={() => setViewTopic(true)}
                      className={css.HeaderTopic}
                      size="T200"
                      priority="300"
                      truncate
                    >
                      {topic}
                    </Text>
                  </>
                )}
              </UseStateProvider>
            )}
          </Box>
        </Box>
        <Box shrink="No">
          {!ecryptedRoom && (
            <TooltipProvider
              position="Bottom"
              offset={4}
              tooltip={
                <Tooltip>
                  <Text>Search</Text>
                </Tooltip>
              }
            >
              {(triggerRef) => (
                <IconButton ref={triggerRef} onClick={handleSearchClick}>
                  <Icon size="400" src={Icons.Search} />
                </IconButton>
              )}
            </TooltipProvider>
          )}
          {screenSize !== ScreenSize.Mobile && (
            <>
              <TooltipProvider
                position="Bottom"
                offset={4}
                tooltip={
                  <Tooltip>
                    <Text>Pinned Messages</Text>
                  </Tooltip>
                }
              >
                {(triggerRef) => (
                  <IconButton
                    style={{ position: 'relative' }}
                    onClick={handleOpenPinMenu}
                    ref={triggerRef}
                    aria-pressed={!!pinMenuAnchor}
                  >
                    {pinnedEvents.length > 0 && (
                      <Badge
                        style={{
                          position: 'absolute',
                          left: toRem(3),
                          top: toRem(3),
                        }}
                        variant="Secondary"
                        size="400"
                        fill="Solid"
                        radii="Pill"
                      >
                        <Text as="span" size="L400">
                          {pinnedEvents.length}
                        </Text>
                      </Badge>
                    )}
                    <Icon size="400" src={Icons.Pin} filled={!!pinMenuAnchor} />
                  </IconButton>
                )}
              </TooltipProvider>
              <PopOut
                anchor={pinMenuAnchor}
                position="Bottom"
                content={
                  <FocusTrap
                    focusTrapOptions={{
                      initialFocus: false,
                      returnFocusOnDeactivate: false,
                      onDeactivate: () => setPinMenuAnchor(undefined),
                      clickOutsideDeactivates: true,
                      isKeyForward: (evt: KeyboardEvent) => evt.key === 'ArrowDown',
                      isKeyBackward: (evt: KeyboardEvent) => evt.key === 'ArrowUp',
                      escapeDeactivates: stopPropagation,
                    }}
                  >
                    <RoomPinMenu room={room} onClose={() => setPinMenuAnchor(undefined)} />
                  </FocusTrap>
                }
              />
            </>
          )}
          {screenSize === ScreenSize.Desktop && (
            <TooltipProvider
              position="Bottom"
              offset={4}
              tooltip={
                <Tooltip>
                  <Text>{peopleDrawer ? 'Hide Members' : 'Show Members'}</Text>
                </Tooltip>
              }
            >
              {(triggerRef) => (
                <IconButton ref={triggerRef} onClick={() => setPeopleDrawer((drawer) => !drawer)}>
                  <Icon size="400" src={Icons.User} />
                </IconButton>
              )}
            </TooltipProvider>
          )}
          <TooltipProvider
            position="Bottom"
            offset={4}
            tooltip={
              <Tooltip>
                <Text>Timeline Slider</Text>
              </Tooltip>
            }
          >
            {(triggerRef) => (
              <IconButton
                ref={triggerRef}
                onClick={() => setSliderVisible((v) => !v)}
                aria-pressed={sliderVisible}
              >
                <Icon size="400" src={Icons.ArrowUpDown} filled={sliderVisible} />
              </IconButton>
            )}
          </TooltipProvider>
          <TooltipProvider
            position="Bottom"
            align="End"
            offset={4}
            tooltip={
              <Tooltip>
                <Text>More Options</Text>
              </Tooltip>
            }
          >
            {(triggerRef) => (
              <IconButton onClick={handleOpenMenu} ref={triggerRef} aria-pressed={!!menuAnchor}>
                <Icon size="400" src={Icons.VerticalDots} filled={!!menuAnchor} />
              </IconButton>
            )}
          </TooltipProvider>
          <PopOut
            anchor={menuAnchor}
            position="Bottom"
            align="End"
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
                <RoomMenu room={room} onClose={() => setMenuAnchor(undefined)} />
              </FocusTrap>
            }
          />
        </Box>
      </Box>
    </PageHeader>
  );
}
