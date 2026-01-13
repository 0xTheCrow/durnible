/**
 * Revy Layout Component
 * Main app shell for Revy Comms
 *
 * Implements the premium, AI-native layout with:
 * - 56px Navigation Rail
 * - 240px Channel List (collapsible)
 * - Flexible Message Area
 * - 320px Context Panel (collapsible)
 */

import React, { ReactNode, useState, useCallback, createContext, useContext, useMemo } from 'react';
import classNames from 'classnames';
import * as css from './RevyLayout.css';

// ============================================================================
// ICONS
// ============================================================================

const ChevronDownIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="m6 9 6 6 6-6" />
  </svg>
);

const XIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M18 6 6 18" />
    <path d="m6 6 12 12" />
  </svg>
);

const PlusIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M5 12h14" />
    <path d="M12 5v14" />
  </svg>
);

const SearchIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="11" cy="11" r="8" />
    <path d="m21 21-4.3-4.3" />
  </svg>
);

const HashIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="4" x2="20" y1="9" y2="9" />
    <line x1="4" x2="20" y1="15" y2="15" />
    <line x1="10" x2="8" y1="3" y2="21" />
    <line x1="16" x2="14" y1="3" y2="21" />
  </svg>
);

const MessageSquareIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
  </svg>
);

// ============================================================================
// CONTEXT
// ============================================================================

interface RevyLayoutContextValue {
  channelListCollapsed: boolean;
  contextPanelCollapsed: boolean;
  toggleChannelList: () => void;
  toggleContextPanel: () => void;
  openContextPanel: () => void;
  closeContextPanel: () => void;
}

const RevyLayoutContext = createContext<RevyLayoutContextValue | null>(null);

export function useRevyLayout() {
  const context = useContext(RevyLayoutContext);
  if (!context) {
    throw new Error('useRevyLayout must be used within a RevyLayoutProvider');
  }
  return context;
}

// ============================================================================
// ROOT LAYOUT
// ============================================================================

interface RevyLayoutProps {
  children: ReactNode;
  navRail: ReactNode;
  channelList?: ReactNode;
  contextPanel?: ReactNode;
  defaultChannelListCollapsed?: boolean;
  defaultContextPanelCollapsed?: boolean;
}

export function RevyLayout({
  children,
  navRail,
  channelList,
  contextPanel,
  defaultChannelListCollapsed = false,
  defaultContextPanelCollapsed = true,
}: RevyLayoutProps) {
  const [channelListCollapsed, setChannelListCollapsed] = useState(defaultChannelListCollapsed);
  const [contextPanelCollapsed, setContextPanelCollapsed] = useState(defaultContextPanelCollapsed);

  const toggleChannelList = useCallback(() => {
    setChannelListCollapsed((prev) => !prev);
  }, []);

  const toggleContextPanel = useCallback(() => {
    setContextPanelCollapsed((prev) => !prev);
  }, []);

  const openContextPanel = useCallback(() => {
    setContextPanelCollapsed(false);
  }, []);

  const closeContextPanel = useCallback(() => {
    setContextPanelCollapsed(true);
  }, []);

  const contextValue = useMemo(
    () => ({
      channelListCollapsed,
      contextPanelCollapsed,
      toggleChannelList,
      toggleContextPanel,
      openContextPanel,
      closeContextPanel,
    }),
    [channelListCollapsed, contextPanelCollapsed, toggleChannelList, toggleContextPanel, openContextPanel, closeContextPanel]
  );

  return (
    <RevyLayoutContext.Provider value={contextValue}>
      <div className={css.RevyRoot}>
        {/* Navigation Rail */}
        {navRail}

        {/* Main Content Area */}
        <div className={css.RevyMain}>
          {/* Channel List Panel */}
          {channelList && !channelListCollapsed && (
            <div className={css.ChannelListPanel({ collapsed: channelListCollapsed })}>
              {channelList}
            </div>
          )}

          {/* Message Area */}
          <div className={css.MessageArea}>{children}</div>

          {/* Context Panel */}
          {contextPanel && !contextPanelCollapsed && (
            <div className={css.ContextPanel({ collapsed: contextPanelCollapsed })}>
              {contextPanel}
            </div>
          )}
        </div>
      </div>
    </RevyLayoutContext.Provider>
  );
}

// ============================================================================
// CHANNEL LIST COMPONENTS
// ============================================================================

interface ChannelListProps {
  title: string;
  children: ReactNode;
  onCreateNew?: () => void;
}

export function ChannelList({ title, children, onCreateNew }: ChannelListProps) {
  const [filter, setFilter] = useState('');

  return (
    <>
      <div className={css.ChannelListHeader}>
        <span className={css.ChannelListTitle}>{title}</span>
        {onCreateNew && (
          <button
            className={css.ChannelListAction}
            onClick={onCreateNew}
            type="button"
            aria-label="Create new"
          >
            <PlusIcon />
          </button>
        )}
      </div>

      <div className={css.ChannelListSearch}>
        <span style={{ width: 16, height: 16 }}>
          <SearchIcon />
        </span>
        <input
          type="text"
          className={css.ChannelListSearchInput}
          placeholder="Filter..."
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
        />
      </div>

      <div className={css.ChannelListContent}>{children}</div>
    </>
  );
}

interface ChannelSectionProps {
  title: string;
  children: ReactNode;
  defaultCollapsed?: boolean;
}

export function ChannelSection({ title, children, defaultCollapsed = false }: ChannelSectionProps) {
  const [collapsed, setCollapsed] = useState(defaultCollapsed);

  return (
    <div className={css.ChannelSection}>
      <button
        className={css.ChannelSectionHeader}
        onClick={() => setCollapsed(!collapsed)}
        type="button"
      >
        <span className={css.ChannelSectionChevron({ collapsed })}>
          <ChevronDownIcon />
        </span>
        {title}
      </button>
      {!collapsed && children}
    </div>
  );
}

interface ChannelItemProps {
  icon?: ReactNode;
  name: string;
  badge?: number;
  active?: boolean;
  unread?: boolean;
  muted?: boolean;
  onClick?: () => void;
}

export function ChannelItem({
  icon,
  name,
  badge,
  active = false,
  unread = false,
  muted = false,
  onClick,
}: ChannelItemProps) {
  return (
    <button
      className={css.ChannelItem({ active, unread, muted })}
      onClick={onClick}
      type="button"
    >
      <span className={css.ChannelItemIcon}>
        {icon || <HashIcon />}
      </span>
      <span className={css.ChannelItemName}>{name}</span>
      {badge !== undefined && badge > 0 && (
        <span className={css.ChannelItemBadge}>{badge > 99 ? '99+' : badge}</span>
      )}
      {unread && !badge && <span className={css.ChannelItemIndicator} />}
    </button>
  );
}

// ============================================================================
// MESSAGE AREA COMPONENTS
// ============================================================================

interface MessageAreaHeaderProps {
  icon?: ReactNode;
  title: string;
  subtitle?: string;
  children?: ReactNode;
}

export function MessageAreaHeader({ icon, title, subtitle, children }: MessageAreaHeaderProps) {
  return (
    <div className={css.MessageAreaHeader}>
      {icon && <span className={css.MessageAreaHeaderIcon}>{icon}</span>}
      <span className={css.MessageAreaHeaderTitle}>{title}</span>
      {subtitle && <span className={css.MessageAreaHeaderSubtitle}>{subtitle}</span>}
      {children}
    </div>
  );
}

interface MessageAreaContentProps {
  children: ReactNode;
}

export function MessageAreaContent({ children }: MessageAreaContentProps) {
  return <div className={css.MessageAreaContent}>{children}</div>;
}

// ============================================================================
// CONTEXT PANEL COMPONENTS
// ============================================================================

interface ContextPanelHeaderProps {
  title: string;
}

export function ContextPanelHeader({ title }: ContextPanelHeaderProps) {
  const { closeContextPanel } = useRevyLayout();

  return (
    <div className={css.ContextPanelHeader}>
      <span className={css.ContextPanelTitle}>{title}</span>
      <button
        className={css.ContextPanelClose}
        onClick={closeContextPanel}
        type="button"
        aria-label="Close panel"
      >
        <XIcon />
      </button>
    </div>
  );
}

interface ContextPanelContentProps {
  children: ReactNode;
}

export function ContextPanelContent({ children }: ContextPanelContentProps) {
  return <div className={css.ContextPanelContent}>{children}</div>;
}

interface ContextSectionProps {
  title: string;
  children: ReactNode;
}

export function ContextSection({ title, children }: ContextSectionProps) {
  return (
    <div className={css.ContextSection}>
      <div className={css.ContextSectionTitle}>{title}</div>
      <div className={css.ContextSectionContent}>{children}</div>
    </div>
  );
}

interface ContextInfoRowProps {
  label: string;
  value: string | ReactNode;
}

export function ContextInfoRow({ label, value }: ContextInfoRowProps) {
  return (
    <div className={css.ContextInfoRow}>
      <span className={css.ContextInfoLabel}>{label}</span>
      <span className={css.ContextInfoValue}>{value}</span>
    </div>
  );
}

interface ParticipantItemProps {
  name: string;
  role?: string;
  avatar?: string;
  onClick?: () => void;
}

export function ParticipantItem({ name, role, avatar, onClick }: ParticipantItemProps) {
  const initials = name
    .split(' ')
    .map((word) => word[0])
    .join('')
    .substring(0, 2)
    .toUpperCase();

  return (
    <button className={css.ParticipantItem} onClick={onClick} type="button">
      <div className={css.ParticipantAvatar}>
        {avatar ? (
          <img src={avatar} alt={name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        ) : (
          initials
        )}
      </div>
      <div className={css.ParticipantInfo}>
        <div className={css.ParticipantName}>{name}</div>
        {role && <div className={css.ParticipantRole}>{role}</div>}
      </div>
    </button>
  );
}

// ============================================================================
// WELCOME SCREEN
// ============================================================================

interface WelcomeScreenProps {
  onOpenCommandPalette?: () => void;
}

export function WelcomeScreen({ onOpenCommandPalette }: WelcomeScreenProps) {
  return (
    <div className={css.WelcomeScreen}>
      <div className={css.WelcomeLogo}>
        <MessageSquareIcon />
      </div>
      <h1 className={css.WelcomeTitle}>Welcome to Revy Comms</h1>
      <p className={css.WelcomeSubtitle}>
        Your AI-powered team communication platform. Select a channel to get started, or use the
        command palette to navigate.
      </p>
      <button className={css.WelcomeShortcut} onClick={onOpenCommandPalette} type="button">
        Press <span className={css.WelcomeKey}>⌘K</span> to open command palette
      </button>
    </div>
  );
}

// ============================================================================
// EXPORTS
// ============================================================================

export default RevyLayout;
