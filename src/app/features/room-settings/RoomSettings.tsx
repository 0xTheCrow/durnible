import React, { useMemo, useState } from 'react';
import { useAtomValue } from 'jotai';
import type { IconSrc } from 'folds';
import { Avatar, Box, config, Icon, IconButton, Icons, MenuItem, Text } from 'folds';
import { JoinRule } from 'matrix-js-sdk';
import { PageNav, PageNavContent, PageNavHeader, PageRoot } from '../../components/page';
import { ScreenSize, useScreenSizeContext } from '../../hooks/useScreenSize';
import { useMatrixClient } from '../../hooks/useMatrixClient';
import { mxcUrlToHttp } from '../../utils/matrix';
import { isCallRoom } from '../../utils/room';
import { useMediaAuthentication } from '../../hooks/useMediaAuthentication';
import { useRoomAvatar, useRoomJoinRule, useRoomName } from '../../hooks/useRoomMeta';
import { mDirectAtom } from '../../state/mDirectList';
import { RoomAvatar, RoomIcon } from '../../components/room-avatar';
import { General } from './general';
import { Members } from '../common-settings/members';
import { EmojisStickers } from '../common-settings/emojis-stickers';
import { Permissions } from './permissions';
import { Encryption } from './encryption';
import { RoomSettingsPage } from '../../state/roomSettings';
import { useRoom } from '../../hooks/useRoom';
import { DeveloperTools } from '../common-settings/developer-tools';
import { usePermissionGroups } from './permissions/usePermissionItems';
import type { RoomSettingsSearchPages } from '../common-settings/search';
import { useRoomSettingsSearchEntries } from '../common-settings/search';
import {
  SettingsSearchInput,
  SettingsSearchResults,
  useSettingsSearch,
} from '../../components/settings-search';

const SEARCH_PLACEHOLDER = 'Search room settings...';

const SEARCH_PAGES: RoomSettingsSearchPages<RoomSettingsPage> = {
  general: RoomSettingsPage.GeneralPage,
  members: RoomSettingsPage.MembersPage,
  permissions: RoomSettingsPage.PermissionsPage,
  emojisStickers: RoomSettingsPage.EmojisStickersPage,
  developerTools: RoomSettingsPage.DeveloperToolsPage,
  encryption: RoomSettingsPage.EncryptionPage,
};

type RoomSettingsMenuItem = {
  page: RoomSettingsPage;
  name: string;
  icon: IconSrc;
};

const useRoomSettingsMenuItems = (isEncrypted: boolean): RoomSettingsMenuItem[] =>
  useMemo(
    () => [
      {
        page: RoomSettingsPage.GeneralPage,
        name: 'General',
        icon: Icons.Setting,
      },
      {
        page: RoomSettingsPage.MembersPage,
        name: 'Members',
        icon: Icons.User,
      },
      {
        page: RoomSettingsPage.PermissionsPage,
        name: 'Permissions',
        icon: Icons.Lock,
      },
      {
        page: RoomSettingsPage.EmojisStickersPage,
        name: 'Emojis & Stickers',
        icon: Icons.Smile,
      },
      ...(isEncrypted
        ? [
            {
              page: RoomSettingsPage.EncryptionPage,
              name: 'Encryption',
              icon: Icons.ShieldLock,
            },
          ]
        : []),
      {
        page: RoomSettingsPage.DeveloperToolsPage,
        name: 'Developer Tools',
        icon: Icons.Terminal,
      },
    ],
    [isEncrypted]
  );

type RoomSettingsProps = {
  initialPage?: RoomSettingsPage;
  onClose: () => void;
};
export function RoomSettings({ initialPage, onClose }: RoomSettingsProps) {
  const room = useRoom();
  const mx = useMatrixClient();
  const useAuthentication = useMediaAuthentication();
  const mDirects = useAtomValue(mDirectAtom);

  const roomAvatar = useRoomAvatar(room, mDirects.has(room.roomId));
  const roomName = useRoomName(room);
  const joinRuleContent = useRoomJoinRule(room);

  const avatarUrl = roomAvatar
    ? mxcUrlToHttp(mx, roomAvatar, useAuthentication, 96, 96, 'crop') ?? undefined
    : undefined;

  const isMobile = useScreenSizeContext() === ScreenSize.Mobile;
  const [activePage, setActivePage] = useState<RoomSettingsPage | undefined>(() => {
    if (initialPage) return initialPage;
    return isMobile ? undefined : RoomSettingsPage.GeneralPage;
  });
  const menuItems = useRoomSettingsMenuItems(room.hasEncryptionStateEvent());

  const search = useSettingsSearch();
  const permissionGroups = usePermissionGroups();
  const searchEntries = useRoomSettingsSearchEntries(SEARCH_PAGES, permissionGroups);

  const handlePageRequestClose = () => {
    if (isMobile) {
      setActivePage(undefined);
      return;
    }
    onClose();
  };

  const handleNavigateTo = (page: RoomSettingsPage) => {
    setActivePage(page);
    search.clearSearch();
  };

  return (
    <PageRoot
      nav={
        isMobile && (activePage !== undefined || search.isSearching) ? undefined : (
          <PageNav size="300">
            <PageNavHeader outlined={false}>
              <Box grow="Yes" gap="200">
                <Avatar size="200" radii="300">
                  <RoomAvatar
                    roomId={room.roomId}
                    src={avatarUrl}
                    alt={roomName}
                    renderFallback={() => (
                      <RoomIcon
                        size="50"
                        joinRule={joinRuleContent?.join_rule ?? JoinRule.Invite}
                        call={isCallRoom(room)}
                        filled
                      />
                    )}
                  />
                </Avatar>
                <Text size="H4" truncate>
                  {roomName}
                </Text>
              </Box>
              <Box shrink="No">
                {isMobile && (
                  <IconButton onClick={onClose} variant="Background">
                    <Icon src={Icons.Cross} />
                  </IconButton>
                )}
              </Box>
            </PageNavHeader>
            <Box grow="Yes" direction="Column">
              <Box
                style={{ padding: `0 ${config.space.S200} ${config.space.S200}` }}
                shrink="No"
                direction="Column"
              >
                <SettingsSearchInput search={search} placeholder={SEARCH_PLACEHOLDER} />
              </Box>
              <PageNavContent>
                <div style={{ flexGrow: 1 }}>
                  {menuItems.map((item) => {
                    const isActive = !search.isSearching && activePage === item.page;
                    return (
                      <MenuItem
                        key={item.name}
                        variant="Background"
                        radii="400"
                        aria-pressed={isActive}
                        before={<Icon src={item.icon} size="100" filled={isActive} />}
                        onClick={() => handleNavigateTo(item.page)}
                      >
                        <Text
                          style={{
                            fontWeight: isActive ? config.fontWeight.W600 : undefined,
                          }}
                          size="T300"
                          truncate
                        >
                          {item.name}
                        </Text>
                      </MenuItem>
                    );
                  })}
                </div>
              </PageNavContent>
            </Box>
          </PageNav>
        )
      }
    >
      {search.isSearching ? (
        <SettingsSearchResults
          search={search}
          entries={searchEntries}
          searchPlaceholder={SEARCH_PLACEHOLDER}
          onClose={onClose}
          onNavigateTo={handleNavigateTo}
        />
      ) : (
        <>
          {activePage === RoomSettingsPage.GeneralPage && (
            <General onClose={handlePageRequestClose} />
          )}
          {activePage === RoomSettingsPage.MembersPage && (
            <Members onClose={handlePageRequestClose} />
          )}
          {activePage === RoomSettingsPage.PermissionsPage && (
            <Permissions onClose={handlePageRequestClose} />
          )}
          {activePage === RoomSettingsPage.EmojisStickersPage && (
            <EmojisStickers onClose={handlePageRequestClose} />
          )}
          {activePage === RoomSettingsPage.EncryptionPage && (
            <Encryption onClose={handlePageRequestClose} />
          )}
          {activePage === RoomSettingsPage.DeveloperToolsPage && (
            <DeveloperTools onClose={handlePageRequestClose} />
          )}
        </>
      )}
    </PageRoot>
  );
}
