import React, { useMemo, useState } from 'react';
import { useAtomValue } from 'jotai';
import type { IconSrc } from 'folds';
import { Avatar, Box, config, Icon, IconButton, Icons, MenuItem, Text } from 'folds';
import { JoinRule } from 'matrix-js-sdk';
import { PageNav, PageNavContent, PageNavHeader, PageRoot } from '../../components/page';
import { ScreenSize, useScreenSizeContext } from '../../hooks/useScreenSize';
import { useMatrixClient } from '../../hooks/useMatrixClient';
import { mxcUrlToHttp } from '../../utils/matrix';
import { useMediaAuthentication } from '../../hooks/useMediaAuthentication';
import { useRoomAvatar, useRoomJoinRule, useRoomName } from '../../hooks/useRoomMeta';
import { mDirectAtom } from '../../state/mDirectList';
import { RoomAvatar, RoomIcon } from '../../components/room-avatar';
import { SpaceSettingsPage } from '../../state/spaceSettings';
import { useRoom } from '../../hooks/useRoom';
import { EmojisStickers } from '../common-settings/emojis-stickers';
import { Members } from '../common-settings/members';
import { DeveloperTools } from '../common-settings/developer-tools';
import { General } from './general';
import { Permissions } from './permissions';
import { usePermissionGroups } from './permissions/usePermissionItems';
import type { RoomSettingsSearchPages } from '../common-settings/search';
import { useRoomSettingsSearchEntries } from '../common-settings/search';
import {
  SettingsSearchInput,
  SettingsSearchResults,
  useSettingsSearch,
} from '../../components/settings-search';

const SEARCH_PLACEHOLDER = 'Search space settings...';

const SEARCH_PAGES: RoomSettingsSearchPages<SpaceSettingsPage> = {
  general: SpaceSettingsPage.GeneralPage,
  members: SpaceSettingsPage.MembersPage,
  permissions: SpaceSettingsPage.PermissionsPage,
  emojisStickers: SpaceSettingsPage.EmojisStickersPage,
  developerTools: SpaceSettingsPage.DeveloperToolsPage,
};

type SpaceSettingsMenuItem = {
  page: SpaceSettingsPage;
  name: string;
  icon: IconSrc;
};

const useSpaceSettingsMenuItems = (): SpaceSettingsMenuItem[] =>
  useMemo(
    () => [
      {
        page: SpaceSettingsPage.GeneralPage,
        name: 'General',
        icon: Icons.Setting,
      },
      {
        page: SpaceSettingsPage.MembersPage,
        name: 'Members',
        icon: Icons.User,
      },
      {
        page: SpaceSettingsPage.PermissionsPage,
        name: 'Permissions',
        icon: Icons.Lock,
      },
      {
        page: SpaceSettingsPage.EmojisStickersPage,
        name: 'Emojis & Stickers',
        icon: Icons.Smile,
      },
      {
        page: SpaceSettingsPage.DeveloperToolsPage,
        name: 'Developer Tools',
        icon: Icons.Terminal,
      },
    ],
    []
  );

type SpaceSettingsProps = {
  initialPage?: SpaceSettingsPage;
  onClose: () => void;
};
export function SpaceSettings({ initialPage, onClose }: SpaceSettingsProps) {
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
  const [activePage, setActivePage] = useState<SpaceSettingsPage | undefined>(() => {
    if (initialPage) return initialPage;
    return isMobile ? undefined : SpaceSettingsPage.GeneralPage;
  });
  const menuItems = useSpaceSettingsMenuItems();

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

  const handleNavigateTo = (page: SpaceSettingsPage) => {
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
                        space
                        size="50"
                        joinRule={joinRuleContent?.join_rule ?? JoinRule.Invite}
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
          {activePage === SpaceSettingsPage.GeneralPage && (
            <General onClose={handlePageRequestClose} />
          )}
          {activePage === SpaceSettingsPage.MembersPage && (
            <Members onClose={handlePageRequestClose} />
          )}
          {activePage === SpaceSettingsPage.PermissionsPage && (
            <Permissions onClose={handlePageRequestClose} />
          )}
          {activePage === SpaceSettingsPage.EmojisStickersPage && (
            <EmojisStickers onClose={handlePageRequestClose} />
          )}
          {activePage === SpaceSettingsPage.DeveloperToolsPage && (
            <DeveloperTools onClose={handlePageRequestClose} />
          )}
        </>
      )}
    </PageRoot>
  );
}
