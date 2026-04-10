import React, { ChangeEventHandler, useMemo, useState } from 'react';
import {
  Avatar,
  Box,
  Button,
  config,
  Icon,
  IconButton,
  Icons,
  IconSrc,
  Input,
  MenuItem,
  Text,
} from 'folds';
import { General } from './general';
import { PageNav, PageNavContent, PageNavHeader, PageRoot } from '../../components/page';
import { ScreenSize, useScreenSizeContext } from '../../hooks/useScreenSize';
import { Account } from './account';
import { useUserProfile } from '../../hooks/useUserProfile';
import { useMatrixClient } from '../../hooks/useMatrixClient';
import { getMxIdLocalPart, mxcUrlToHttp } from '../../utils/matrix';
import { useMediaAuthentication } from '../../hooks/useMediaAuthentication';
import { UserAvatar } from '../../components/user-avatar';
import { nameInitials } from '../../utils/common';
import { Notifications } from './notifications';
import { Devices } from './devices';
import { EmojisStickers } from './emojis-stickers';
import { DeveloperTools } from './developer-tools';
import { About } from './about';
import { UseStateProvider } from '../../components/UseStateProvider';
import { LogoutDialog } from '../../components/LogoutDialog';
import { OverlayModal } from '../../components/OverlayModal';
import { SearchResults } from './search/SearchResults';
import { SettingsPages } from './settingsPages';

type SettingsMenuItem = {
  page: SettingsPages;
  name: string;
  icon: IconSrc;
};

const useSettingsMenuItems = (): SettingsMenuItem[] =>
  useMemo(
    () => [
      {
        page: SettingsPages.GeneralPage,
        name: 'General',
        icon: Icons.Setting,
      },
      {
        page: SettingsPages.AccountPage,
        name: 'Account',
        icon: Icons.User,
      },
      {
        page: SettingsPages.NotificationPage,
        name: 'Notifications',
        icon: Icons.Bell,
      },
      {
        page: SettingsPages.DevicesPage,
        name: 'Devices',
        icon: Icons.Monitor,
      },
      {
        page: SettingsPages.EmojisStickersPage,
        name: 'Emojis & Stickers',
        icon: Icons.Smile,
      },
      {
        page: SettingsPages.DeveloperToolsPage,
        name: 'Developer Tools',
        icon: Icons.Terminal,
      },
      {
        page: SettingsPages.AboutPage,
        name: 'About',
        icon: Icons.Info,
      },
    ],
    []
  );

type SettingsProps = {
  initialPage?: SettingsPages;
  requestClose: () => void;
};
export function Settings({ initialPage, requestClose }: SettingsProps) {
  const mx = useMatrixClient();
  const useAuthentication = useMediaAuthentication();
  const userId = mx.getSafeUserId();
  const profile = useUserProfile(userId);
  const displayName = profile.displayName ?? getMxIdLocalPart(userId) ?? userId;
  const avatarUrl = profile.avatarUrl
    ? mxcUrlToHttp(mx, profile.avatarUrl, useAuthentication, 96, 96, 'crop') ?? undefined
    : undefined;

  const screenSize = useScreenSizeContext();
  const [activePage, setActivePage] = useState<SettingsPages | undefined>(() => {
    if (initialPage) return initialPage;
    return screenSize === ScreenSize.Mobile ? undefined : SettingsPages.GeneralPage;
  });
  const [searchQuery, setSearchQuery] = useState('');
  const menuItems = useSettingsMenuItems();

  const handleSearchChange: ChangeEventHandler<HTMLInputElement> = (evt) => {
    setSearchQuery(evt.target.value);
  };

  const handleSearchClear = () => {
    setSearchQuery('');
  };

  const handleNavigateTo = (page: SettingsPages) => {
    setActivePage(page);
    setSearchQuery('');
  };

  const handlePageRequestClose = () => {
    if (screenSize === ScreenSize.Mobile) {
      setActivePage(undefined);
      return;
    }
    requestClose();
  };

  return (
    <PageRoot
      nav={
        screenSize === ScreenSize.Mobile &&
        (activePage !== undefined || searchQuery.trim()) ? undefined : (
          <PageNav size="300">
            <PageNavHeader outlined={false}>
              <Box grow="Yes" gap="200">
                <Avatar size="200" radii="300">
                  <UserAvatar
                    userId={userId}
                    src={avatarUrl}
                    renderFallback={() => <Text size="H6">{nameInitials(displayName)}</Text>}
                  />
                </Avatar>
                <Text size="H4" truncate>
                  Settings
                </Text>
              </Box>
              <Box shrink="No">
                {screenSize === ScreenSize.Mobile && (
                  <IconButton onClick={requestClose} variant="Background">
                    <Icon src={Icons.Cross} />
                  </IconButton>
                )}
              </Box>
            </PageNavHeader>
            <Box grow="Yes" direction="Column">
              <Box style={{ padding: `0 ${config.space.S200} ${config.space.S200}` }} shrink="No">
                <Input
                  style={{ width: '100%' }}
                  variant="Background"
                  size="300"
                  radii="400"
                  autoFocus={screenSize !== ScreenSize.Mobile}
                  placeholder="Search settings..."
                  before={<Icon src={Icons.Search} size="100" />}
                  value={searchQuery}
                  onChange={handleSearchChange}
                  after={
                    searchQuery ? (
                      <IconButton
                        size="300"
                        onClick={handleSearchClear}
                        variant="Background"
                        radii="Pill"
                      >
                        <Icon src={Icons.Cross} size="100" />
                      </IconButton>
                    ) : undefined
                  }
                />
              </Box>
              <PageNavContent>
                <div style={{ flexGrow: 1 }}>
                  {menuItems.map((item) => (
                    <MenuItem
                      key={item.name}
                      variant="Background"
                      radii="400"
                      aria-pressed={activePage === item.page}
                      before={<Icon src={item.icon} size="100" filled={activePage === item.page} />}
                      onClick={() => setActivePage(item.page)}
                    >
                      <Text
                        style={{
                          fontWeight: activePage === item.page ? config.fontWeight.W600 : undefined,
                        }}
                        size="T300"
                        truncate
                      >
                        {item.name}
                      </Text>
                    </MenuItem>
                  ))}
                </div>
              </PageNavContent>
              <Box style={{ padding: config.space.S200 }} shrink="No" direction="Column">
                <UseStateProvider initial={false}>
                  {(logout, setLogout) => (
                    <>
                      <Button
                        size="300"
                        variant="Critical"
                        fill="None"
                        radii="Pill"
                        before={<Icon src={Icons.Power} size="100" />}
                        onClick={() => setLogout(true)}
                      >
                        <Text size="B400">Logout</Text>
                      </Button>
                      {logout && (
                        <OverlayModal open requestClose={() => setLogout(false)}>
                          <LogoutDialog handleClose={() => setLogout(false)} />
                        </OverlayModal>
                      )}
                    </>
                  )}
                </UseStateProvider>
              </Box>
            </Box>
          </PageNav>
        )
      }
    >
      {searchQuery.trim() ? (
        <SearchResults
          query={searchQuery}
          requestClose={handlePageRequestClose}
          onNavigateTo={handleNavigateTo}
        />
      ) : (
        <>
          {activePage === SettingsPages.GeneralPage && (
            <General requestClose={handlePageRequestClose} />
          )}
          {activePage === SettingsPages.AccountPage && (
            <Account requestClose={handlePageRequestClose} />
          )}
          {activePage === SettingsPages.NotificationPage && (
            <Notifications requestClose={handlePageRequestClose} />
          )}
          {activePage === SettingsPages.DevicesPage && (
            <Devices requestClose={handlePageRequestClose} />
          )}
          {activePage === SettingsPages.EmojisStickersPage && (
            <EmojisStickers requestClose={handlePageRequestClose} />
          )}
          {activePage === SettingsPages.DeveloperToolsPage && (
            <DeveloperTools requestClose={handlePageRequestClose} />
          )}
          {activePage === SettingsPages.AboutPage && (
            <About requestClose={handlePageRequestClose} />
          )}
        </>
      )}
    </PageRoot>
  );
}
