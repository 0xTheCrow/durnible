import React, { useMemo, useState } from 'react';
import type { IconSrc } from 'folds';
import { Avatar, Box, Button, config, Icon, IconButton, Icons, MenuItem, Text } from 'folds';
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
import { VoiceVideo } from './voice-video';
import { EmojisStickers } from './emojis-stickers';
import { Keybinds } from './keybinds';
import { DeveloperTools } from './developer-tools';
import { About } from './about';
import { UseStateProvider } from '../../components/UseStateProvider';
import { LogoutDialog } from '../../components/LogoutDialog';
import { OverlayModal } from '../../components/OverlayModal';
import { settingsSearchData } from './search/searchData';
import { SettingsPages } from './settingsPages';
import {
  SettingsSearchInput,
  SettingsSearchResults,
  useSettingsSearch,
} from '../../components/settings-search';

const SEARCH_PLACEHOLDER = 'Search settings...';

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
        page: SettingsPages.VoiceVideoPage,
        name: 'Voice & Video',
        icon: Icons.Headphone,
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

  const isMobile = useScreenSizeContext() === ScreenSize.Mobile;
  const [activePage, setActivePage] = useState<SettingsPages | undefined>(() => {
    if (initialPage) return initialPage;
    return isMobile ? undefined : SettingsPages.GeneralPage;
  });
  const search = useSettingsSearch();
  const menuItems = useSettingsMenuItems();

  const handleNavigateTo = (page: SettingsPages) => {
    setActivePage(page);
    search.clearSearch();
  };

  const handleBackToMenu = () => {
    setActivePage(undefined);
  };

  return (
    <PageRoot
      nav={
        isMobile && (activePage !== undefined || search.isSearching) ? undefined : (
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
      {search.isSearching ? (
        <SettingsSearchResults
          search={search}
          entries={settingsSearchData}
          searchPlaceholder={SEARCH_PLACEHOLDER}
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
          {activePage === SettingsPages.VoiceVideoPage && (
            <VoiceVideo onBack={handleBackToMenu} onClose={onClose} />
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
