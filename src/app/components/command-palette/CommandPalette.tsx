/**
 * Command Palette Component
 * Superhuman-inspired command palette for Revy Comms
 *
 * Features:
 * - Instant search with fuzzy matching
 * - Keyboard navigation (arrows, enter, escape)
 * - Categorized results (Recent, Channels, DMs, Commands)
 * - Shortcuts display
 * - AI commands integration ready
 */

import React, {
  useState,
  useEffect,
  useCallback,
  useRef,
  useMemo,
  createContext,
  useContext,
  ReactNode,
  KeyboardEvent,
} from 'react';
import { createPortal } from 'react-dom';
import classNames from 'classnames';
import * as css from './CommandPalette.css';

// ============================================================================
// ICONS (inline SVG for independence)
// ============================================================================

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

const UserIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" />
    <circle cx="12" cy="7" r="4" />
  </svg>
);

const BotIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 8V4H8" />
    <rect width="16" height="12" x="4" y="8" rx="2" />
    <path d="M2 14h2" />
    <path d="M20 14h2" />
    <path d="M15 13v2" />
    <path d="M9 13v2" />
  </svg>
);

const PlusIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M5 12h14" />
    <path d="M12 5v14" />
  </svg>
);

const SettingsIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" />
    <circle cx="12" cy="12" r="3" />
  </svg>
);

const SearchXIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="m13.5 8.5-5 5" />
    <path d="m8.5 8.5 5 5" />
    <circle cx="11" cy="11" r="8" />
    <path d="m21 21-4.3-4.3" />
  </svg>
);

const XIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M18 6 6 18" />
    <path d="m6 6 12 12" />
  </svg>
);

// ============================================================================
// TYPES
// ============================================================================

export type CommandItemType = 'channel' | 'dm' | 'ai' | 'action' | 'setting' | 'recent';

export interface CommandItem {
  id: string;
  type: CommandItemType;
  title: string;
  description?: string;
  icon?: ReactNode;
  shortcut?: string[];
  badge?: string | number;
  onSelect?: () => void;
  disabled?: boolean;
  keywords?: string[];
}

export interface CommandSection {
  id: string;
  title: string;
  items: CommandItem[];
}

interface CommandPaletteContextValue {
  isOpen: boolean;
  open: () => void;
  close: () => void;
  toggle: () => void;
}

// ============================================================================
// CONTEXT
// ============================================================================

const CommandPaletteContext = createContext<CommandPaletteContextValue | null>(null);

export function useCommandPalette() {
  const context = useContext(CommandPaletteContext);
  if (!context) {
    throw new Error('useCommandPalette must be used within a CommandPaletteProvider');
  }
  return context;
}

// ============================================================================
// PROVIDER
// ============================================================================

interface CommandPaletteProviderProps {
  children: ReactNode;
  commands?: CommandSection[];
  onCommand?: (item: CommandItem) => void;
}

export function CommandPaletteProvider({
  children,
  commands = [],
  onCommand,
}: CommandPaletteProviderProps) {
  const [isOpen, setIsOpen] = useState(false);

  const open = useCallback(() => setIsOpen(true), []);
  const close = useCallback(() => setIsOpen(false), []);
  const toggle = useCallback(() => setIsOpen((prev) => !prev), []);

  // Global keyboard shortcut (Cmd+K / Ctrl+K)
  useEffect(() => {
    const handleKeyDown = (event: globalThis.KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key === 'k') {
        event.preventDefault();
        toggle();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [toggle]);

  const handleCommand = useCallback(
    (item: CommandItem) => {
      if (item.onSelect) {
        item.onSelect();
      }
      if (onCommand) {
        onCommand(item);
      }
      close();
    },
    [onCommand, close]
  );

  const value = useMemo(
    () => ({ isOpen, open, close, toggle }),
    [isOpen, open, close, toggle]
  );

  return (
    <CommandPaletteContext.Provider value={value}>
      {children}
      {isOpen && (
        <CommandPaletteModal
          sections={commands}
          onSelect={handleCommand}
          onClose={close}
        />
      )}
    </CommandPaletteContext.Provider>
  );
}

// ============================================================================
// MODAL
// ============================================================================

interface CommandPaletteModalProps {
  sections: CommandSection[];
  onSelect: (item: CommandItem) => void;
  onClose: () => void;
}

function CommandPaletteModal({ sections, onSelect, onClose }: CommandPaletteModalProps) {
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [animationState, setAnimationState] = useState<'entering' | 'entered' | 'exiting'>('entering');
  const inputRef = useRef<HTMLInputElement>(null);
  const resultsRef = useRef<HTMLDivElement>(null);

  // Focus input on mount
  useEffect(() => {
    inputRef.current?.focus();
    const timer = setTimeout(() => setAnimationState('entered'), 150);
    return () => clearTimeout(timer);
  }, []);

  // Filter items based on query
  const filteredSections = useMemo(() => {
    if (!query.trim()) return sections;

    const lowerQuery = query.toLowerCase();

    return sections
      .map((section) => ({
        ...section,
        items: section.items.filter((item) => {
          const titleMatch = item.title.toLowerCase().includes(lowerQuery);
          const descMatch = item.description?.toLowerCase().includes(lowerQuery);
          const keywordMatch = item.keywords?.some((k) => k.toLowerCase().includes(lowerQuery));
          return titleMatch || descMatch || keywordMatch;
        }),
      }))
      .filter((section) => section.items.length > 0);
  }, [sections, query]);

  // Flatten items for keyboard navigation
  const flatItems = useMemo(
    () => filteredSections.flatMap((section) => section.items),
    [filteredSections]
  );

  // Reset selection when results change
  useEffect(() => {
    setSelectedIndex(0);
  }, [query]);

  // Scroll selected item into view
  useEffect(() => {
    if (resultsRef.current && flatItems.length > 0) {
      const selectedElement = resultsRef.current.querySelector(`[data-index="${selectedIndex}"]`);
      selectedElement?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }
  }, [selectedIndex, flatItems.length]);

  // Handle close with animation
  const handleClose = useCallback(() => {
    setAnimationState('exiting');
    setTimeout(onClose, 100);
  }, [onClose]);

  // Keyboard navigation
  const handleKeyDown = useCallback(
    (event: KeyboardEvent<HTMLInputElement>) => {
      switch (event.key) {
        case 'ArrowDown':
          event.preventDefault();
          setSelectedIndex((prev) => (prev < flatItems.length - 1 ? prev + 1 : 0));
          break;
        case 'ArrowUp':
          event.preventDefault();
          setSelectedIndex((prev) => (prev > 0 ? prev - 1 : flatItems.length - 1));
          break;
        case 'Enter':
          event.preventDefault();
          if (flatItems[selectedIndex] && !flatItems[selectedIndex].disabled) {
            onSelect(flatItems[selectedIndex]);
          }
          break;
        case 'Escape':
          event.preventDefault();
          handleClose();
          break;
        case 'Tab':
          // Autocomplete first result
          event.preventDefault();
          if (flatItems.length > 0) {
            setQuery(flatItems[0].title);
          }
          break;
      }
    },
    [flatItems, selectedIndex, onSelect, handleClose]
  );

  // Click outside to close
  const handleBackdropClick = useCallback(
    (event: React.MouseEvent) => {
      if (event.target === event.currentTarget) {
        handleClose();
      }
    },
    [handleClose]
  );

  // Get icon variant based on item type
  const getIconVariant = (type: CommandItemType): css.CommandPaletteItemIconVariants['variant'] => {
    switch (type) {
      case 'channel':
        return 'channel';
      case 'dm':
        return 'dm';
      case 'ai':
        return 'ai';
      case 'action':
        return 'action';
      default:
        return 'default';
    }
  };

  // Get default icon based on item type
  const getDefaultIcon = (type: CommandItemType) => {
    switch (type) {
      case 'channel':
        return <HashIcon />;
      case 'dm':
        return <UserIcon />;
      case 'ai':
        return <BotIcon />;
      case 'action':
        return <PlusIcon />;
      case 'setting':
        return <SettingsIcon />;
      default:
        return <HashIcon />;
    }
  };

  // Highlight matching text
  const highlightMatch = (text: string, query: string) => {
    if (!query.trim()) return text;

    const regex = new RegExp(`(${query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
    const parts = text.split(regex);

    return parts.map((part, i) =>
      regex.test(part) ? (
        <span key={i} className={css.CommandPaletteHighlight}>
          {part}
        </span>
      ) : (
        part
      )
    );
  };

  // Track current index across sections
  let itemIndex = 0;

  const portalContainer = document.getElementById('portalContainer') || document.body;

  return createPortal(
    <div
      className={css.CommandPaletteOverlay({ state: animationState })}
      onClick={handleBackdropClick}
      role="dialog"
      aria-modal="true"
      aria-label="Command palette"
    >
      <div className={css.CommandPalette({ state: animationState })}>
        {/* Search Input */}
        <div className={css.CommandPaletteInputWrapper}>
          <span className={css.CommandPaletteInputIcon}>
            <SearchIcon />
          </span>
          <input
            ref={inputRef}
            type="text"
            className={css.CommandPaletteInput}
            placeholder="Search messages, channels, people, commands..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            aria-label="Search"
            aria-autocomplete="list"
            aria-controls="command-palette-results"
            aria-activedescendant={flatItems[selectedIndex]?.id}
          />
          {query && (
            <button
              className={css.CommandPaletteInputClear}
              onClick={() => setQuery('')}
              aria-label="Clear search"
              type="button"
            >
              <XIcon />
            </button>
          )}
        </div>

        {/* Results */}
        <div
          ref={resultsRef}
          className={css.CommandPaletteResults}
          id="command-palette-results"
          role="listbox"
          aria-label="Search results"
        >
          {filteredSections.length === 0 ? (
            <div className={css.CommandPaletteEmpty}>
              <span className={css.CommandPaletteEmptyIcon}>
                <SearchXIcon />
              </span>
              <span className={css.CommandPaletteEmptyTitle}>No results found</span>
              <span className={css.CommandPaletteEmptyDescription}>
                Try a different search term
              </span>
            </div>
          ) : (
            filteredSections.map((section) => (
              <div key={section.id} className={css.CommandPaletteSection}>
                <div className={css.CommandPaletteSectionHeader}>{section.title}</div>
                {section.items.map((item) => {
                  const currentIndex = itemIndex++;
                  const isSelected = currentIndex === selectedIndex;

                  return (
                    <div
                      key={item.id}
                      id={item.id}
                      data-index={currentIndex}
                      className={css.CommandPaletteItem({
                        selected: isSelected,
                        disabled: item.disabled,
                      })}
                      onClick={() => !item.disabled && onSelect(item)}
                      onMouseEnter={() => setSelectedIndex(currentIndex)}
                      role="option"
                      aria-selected={isSelected}
                      aria-disabled={item.disabled}
                    >
                      <span className={css.CommandPaletteItemIcon({ variant: getIconVariant(item.type) })}>
                        {item.icon || getDefaultIcon(item.type)}
                      </span>

                      <div className={css.CommandPaletteItemContent}>
                        <div className={css.CommandPaletteItemTitle}>
                          {highlightMatch(item.title, query)}
                        </div>
                        {item.description && (
                          <div className={css.CommandPaletteItemDescription}>
                            {highlightMatch(item.description, query)}
                          </div>
                        )}
                      </div>

                      {item.badge && (
                        <span className={css.CommandPaletteItemBadge}>{item.badge}</span>
                      )}

                      {item.shortcut && (
                        <div className={css.CommandPaletteItemShortcut}>
                          {item.shortcut.map((key, i) => (
                            <span key={i} className={css.CommandPaletteItemKey}>
                              {key}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            ))
          )}
        </div>

        {/* Footer */}
        <div className={css.CommandPaletteFooter}>
          <span className={css.CommandPaletteFooterItem}>
            <span className={css.CommandPaletteFooterKey}>esc</span>
            to close
          </span>
          <span className={css.CommandPaletteFooterItem}>
            <span className={css.CommandPaletteFooterKey}>↑↓</span>
            to navigate
          </span>
          <span className={css.CommandPaletteFooterItem}>
            <span className={css.CommandPaletteFooterKey}>⏎</span>
            to select
          </span>
        </div>
      </div>
    </div>,
    portalContainer
  );
}

// ============================================================================
// EXPORTS
// ============================================================================

export default CommandPaletteProvider;
