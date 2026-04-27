import type { ChangeEventHandler, FormEventHandler } from 'react';
import React, { useMemo, useState } from 'react';
import type { IconSrc } from 'folds';
import { Avatar, Box, Button, config, Icon, IconButton, Icons, Input, MenuItem, Text } from 'folds';
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
import { Keybinds } from './keybinds';
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
        page: SettingsPages.KeybindsPage,
        name: 'Keybinds',
        icon: Icons.Code,
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
  onClose: () => void;
};
export function Settings({ initialPage, onClose }: SettingsProps) {
  const mx = useMatrixClient();
  const useAuthentication = useMediaAuthentication();
  const userId = mx.getSafeUserId();
  const profile = useUserProfile(userId);
  const displayName = profile.displayName ?? getMxIdLocalPart(userId) ?? userId;
  const avatarUrl = profile.avatarUrl
    ? mxcUrlToHttp(mx, profile.avatarUrl, useAuthentication, 96, 96, 'crop') ?? undefined
    : undefined;

  const screenSize = useScreenSizeContext();
  const isMobile = screenSize === ScreenSize.Mobile;
  const [activePage, setActivePage] = useState<SettingsPages | undefined>(() => {
    if (initialPage) return initialPage;
    return isMobile ? undefined : SettingsPages.GeneralPage;
  });
  const [searchInput, setSearchInput] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchMode, setSearchMode] = useState(false);
  const menuItems = useSettingsMenuItems();

  const handleSearchChange: ChangeEventHandler<HTMLInputElement> = (evt) => {
    const next = evt.target.value;
    setSearchInput(next);
    if (!isMobile) {
      setSearchQuery(next);
      setSearchMode(next.trim() !== '');
    } else if (next.trim() === '') {
      setSearchQuery(next);
    }
  };

  const handleSearchSubmit: FormEventHandler<HTMLFormElement> = (evt) => {
    evt.preventDefault();
    setSearchQuery(searchInput);
    if (searchInput.trim() !== '') {
      setSearchMode(true);
    }
  };

  const handleSearchClear = () => {
    setSearchInput('');
    setSearchQuery('');
    setSearchMode(false);
  };

  const handleNavigateTo = (page: SettingsPages) => {
    setActivePage(page);
    setSearchInput('');
    setSearchQuery('');
    setSearchMode(false);
  };

  const handleBackToMenu = () => {
    setActivePage(undefined);
  };

  const handleSearchQueryChange = (next: string) => {
    setSearchInput(next);
    setSearchQuery(next);
  };

  return (
    <PageRoot
      nav={
        screenSize === ScreenSize.Mobile && (activePage !== undefined || searchMode) ? undefined : (
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
                  <IconButton onClick={onClose} variant="Background">
                    <Icon src={Icons.Cross} />
                  </IconButton>
                )}
              </Box>
            </PageNavHeader>
            <Box grow="Yes" direction="Column">
              <Box
                as="form"
                onSubmit={handleSearchSubmit}
                gap="200"
                alignItems="Center"
                style={{ padding: `0 ${config.space.S200} ${config.space.S200}` }}
                shrink="No"
              >
                <Box grow="Yes">
                  <Input
                    style={{ width: '100%' }}
                    variant="Background"
                    size="300"
                    radii="400"
                    autoFocus={!isMobile}
                    placeholder="Search settings..."
                    before={<Icon src={Icons.Search} size="100" />}
                    value={searchInput}
                    onChange={handleSearchChange}
                    after={
                      searchInput ? (
                        <IconButton
                          type="button"
                          size="300"
                          onClick={handleSearchClear}
                          variant="Background"
                          radii="Pill"
                          aria-label="Clear search"
                        >
                          <Icon src={Icons.Cross} size="100" />
                        </IconButton>
                      ) : undefined
                    }
                  />
                </Box>
                {isMobile && searchInput && (
                  <Button type="submit" size="300" variant="Primary" radii="400">
                    <Text size="B300">Search</Text>
                  </Button>
                )}
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
                        <OverlayModal open onClose={() => setLogout(false)}>
                          <LogoutDialog onClose={() => setLogout(false)} />
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
      {searchMode ? (
        <SearchResults
          query={searchQuery}
          onQueryChange={handleSearchQueryChange}
          onBack={handleSearchClear}
          onClose={onClose}
          onNavigateTo={handleNavigateTo}
        />
      ) : (
        <>
          {activePage === SettingsPages.GeneralPage && (
            <General onBack={handleBackToMenu} onClose={onClose} />
          )}
          {activePage === SettingsPages.AccountPage && (
            <Account onBack={handleBackToMenu} onClose={onClose} />
          )}
          {activePage === SettingsPages.NotificationPage && (
            <Notifications onBack={handleBackToMenu} onClose={onClose} />
          )}
          {activePage === SettingsPages.DevicesPage && (
            <Devices onBack={handleBackToMenu} onClose={onClose} />
          )}
          {activePage === SettingsPages.EmojisStickersPage && (
            <EmojisStickers onBack={handleBackToMenu} onClose={onClose} />
          )}
          {activePage === SettingsPages.KeybindsPage && (
            <Keybinds onBack={handleBackToMenu} onClose={onClose} />
          )}
          {activePage === SettingsPages.DeveloperToolsPage && (
            <DeveloperTools onBack={handleBackToMenu} onClose={onClose} />
          )}
          {activePage === SettingsPages.AboutPage && (
            <About onBack={handleBackToMenu} onClose={onClose} />
          )}
        </>
      )}
    </PageRoot>
  );
}
