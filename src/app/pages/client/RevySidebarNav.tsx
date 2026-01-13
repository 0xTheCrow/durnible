/**
 * Revy Sidebar Navigation
 * New navigation using the Revy Navigation Rail design
 */

import React, { useCallback, useMemo } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAtomValue } from 'jotai';
import { useMatrixClient } from '../../hooks/useMatrixClient';
import { getHomePathFromClient } from '../../pages/pathUtils';
import {
  NavRail,
  NavRailLogo,
  NavRailDivider,
  NavRailSpacer,
  NavRailItem,
  NavRailAvatar,
  NavRailCommandTrigger,
} from '../../components/nav-rail';
import { useCommandPalette } from '../../components/command-palette';
import { allInvitesAtom } from '../../state/room-list/inviteList';
import { useUserProfile } from '../../hooks/useUserProfile';
import { useMediaAuthentication } from '../../hooks/useMediaAuthentication';
import { mxcUrlToHttp } from '../../utils/matrix';
import { PresenceStatus } from '../../components/nav-rail/NavRail';

// ============================================================================
// ICONS
// ============================================================================

const HomeIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
    <polyline points="9 22 9 12 15 12 15 22" />
  </svg>
);

const MessageSquareIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
  </svg>
);

const HashIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <line x1="4" x2="20" y1="9" y2="9" />
    <line x1="4" x2="20" y1="15" y2="15" />
    <line x1="10" x2="8" y1="3" y2="21" />
    <line x1="16" x2="14" y1="3" y2="21" />
  </svg>
);

const FolderIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M20 20a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.9a2 2 0 0 1-1.69-.9L9.6 3.9A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2Z" />
  </svg>
);

const BotIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 8V4H8" />
    <rect width="16" height="12" x="4" y="8" rx="2" />
    <path d="M2 14h2" />
    <path d="M20 14h2" />
    <path d="M15 13v2" />
    <path d="M9 13v2" />
  </svg>
);

const SettingsIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" />
    <circle cx="12" cy="12" r="3" />
  </svg>
);

const InboxIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="22 12 16 12 14 15 10 15 8 12 2 12" />
    <path d="M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z" />
  </svg>
);

const CompassIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10" />
    <polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76" />
  </svg>
);

const PlusIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <line x1="12" y1="5" x2="12" y2="19" />
    <line x1="5" y1="12" x2="19" y2="12" />
  </svg>
);

// ============================================================================
// COMPONENT
// ============================================================================

export function RevySidebarNav() {
  const mx = useMatrixClient();
  const navigate = useNavigate();
  const location = useLocation();
  const { open: openCommandPalette } = useCommandPalette();
  const allInvites = useAtomValue(allInvitesAtom);
  const useAuthentication = useMediaAuthentication();

  // Get user profile
  const userId = mx.getUserId();
  const profile = useUserProfile(userId);

  // Get avatar URL
  const avatarUrl = useMemo(() => {
    if (!profile?.avatar_url) return undefined;
    return mxcUrlToHttp(mx, profile.avatar_url, useAuthentication, 96, 96, 'crop');
  }, [mx, profile?.avatar_url, useAuthentication]);

  // Get display name
  const displayName = profile?.displayname || userId?.split(':')[0].slice(1) || 'User';

  // Get presence status (simplified)
  const presenceStatus: PresenceStatus = 'online';

  // Determine active section from path
  const getActiveSection = useCallback(() => {
    const path = location.pathname;
    if (path.startsWith('/home')) return 'home';
    if (path.startsWith('/direct')) return 'direct';
    if (path.startsWith('/space')) return 'space';
    if (path.startsWith('/explore')) return 'explore';
    if (path.startsWith('/inbox')) return 'inbox';
    if (path.startsWith('/create')) return 'create';
    return 'home';
  }, [location.pathname]);

  const activeSection = getActiveSection();

  // Count invites
  const inviteCount = allInvites.length;

  // Navigation handlers
  const handleHome = useCallback(() => {
    navigate(getHomePathFromClient(mx));
  }, [mx, navigate]);

  const handleDirect = useCallback(() => {
    navigate('/direct');
  }, [navigate]);

  const handleExplore = useCallback(() => {
    navigate('/explore/featured');
  }, [navigate]);

  const handleInbox = useCallback(() => {
    navigate('/inbox/notifications');
  }, [navigate]);

  const handleCreate = useCallback(() => {
    navigate('/create');
  }, [navigate]);

  const handleSettings = useCallback(() => {
    // Settings are usually opened via a modal or separate route
    // For now, we'll trigger the command palette with a settings filter
    openCommandPalette();
  }, [openCommandPalette]);

  const handleProfile = useCallback(() => {
    // Profile click - could open user settings or profile panel
    openCommandPalette();
  }, [openCommandPalette]);

  return (
    <NavRail>
      {/* Logo */}
      <NavRailLogo onClick={handleHome} />

      {/* Command Palette Trigger */}
      <NavRailCommandTrigger onClick={openCommandPalette} />

      <NavRailDivider />

      {/* Main Navigation */}
      <NavRailItem
        icon={<HomeIcon />}
        label="Home"
        shortcut="G H"
        active={activeSection === 'home'}
        onClick={handleHome}
      />

      <NavRailItem
        icon={<MessageSquareIcon />}
        label="Direct Messages"
        shortcut="G D"
        active={activeSection === 'direct'}
        onClick={handleDirect}
      />

      <NavRailItem
        icon={<HashIcon />}
        label="Channels"
        shortcut="G C"
        active={activeSection === 'space'}
        onClick={() => navigate('/space')}
      />

      <NavRailItem
        icon={<FolderIcon />}
        label="Deals"
        shortcut="G L"
        badge={3}
      />

      <NavRailItem
        icon={<BotIcon />}
        label="AI Agents"
        shortcut="⌘J"
      />

      <NavRailDivider />

      <NavRailItem
        icon={<CompassIcon />}
        label="Explore"
        active={activeSection === 'explore'}
        onClick={handleExplore}
      />

      <NavRailItem
        icon={<PlusIcon />}
        label="Create"
        active={activeSection === 'create'}
        onClick={handleCreate}
        variant="primary"
      />

      <NavRailSpacer />

      {/* Bottom Section */}
      <NavRailItem
        icon={<InboxIcon />}
        label="Inbox"
        shortcut="G I"
        active={activeSection === 'inbox'}
        badge={inviteCount > 0 ? inviteCount : undefined}
        onClick={handleInbox}
      />

      <NavRailItem
        icon={<SettingsIcon />}
        label="Settings"
        shortcut="⌘,"
        onClick={handleSettings}
      />

      <NavRailDivider />

      {/* User Avatar */}
      <NavRailAvatar
        src={avatarUrl}
        alt={displayName}
        presence={presenceStatus}
        onClick={handleProfile}
      />
    </NavRail>
  );
}

export default RevySidebarNav;
