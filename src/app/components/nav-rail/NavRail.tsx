/**
 * Navigation Rail Component
 * 56px icon-only vertical navigation - Revy Comms design
 */

import React, { ReactNode, useState, useCallback, forwardRef } from 'react';
import classNames from 'classnames';
import * as css from './NavRail.css';

// ============================================================================
// TYPES
// ============================================================================

export type PresenceStatus = 'online' | 'away' | 'dnd' | 'offline';

export interface NavRailItemProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  icon: ReactNode;
  label: string;
  shortcut?: string;
  active?: boolean;
  badge?: number | boolean;
  badgeVariant?: 'default' | 'success' | 'warning';
  variant?: 'default' | 'primary' | 'danger';
}

export interface NavRailAvatarProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  src?: string;
  alt?: string;
  fallback?: string;
  presence?: PresenceStatus;
  size?: 'sm' | 'md' | 'lg';
}

// ============================================================================
// NAV RAIL CONTAINER
// ============================================================================

interface NavRailProps {
  children: ReactNode;
  className?: string;
}

export function NavRail({ children, className }: NavRailProps) {
  return (
    <nav className={classNames(css.NavRail, className)} role="navigation" aria-label="Main navigation">
      {children}
    </nav>
  );
}

// ============================================================================
// NAV RAIL LOGO
// ============================================================================

interface NavRailLogoProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  children?: ReactNode;
}

export const NavRailLogo = forwardRef<HTMLButtonElement, NavRailLogoProps>(
  ({ children, className, ...props }, ref) => {
    return (
      <button
        ref={ref}
        className={classNames(css.NavRailLogo, className)}
        type="button"
        aria-label="Revy Comms Home"
        {...props}
      >
        {children || (
          <svg
            className={css.NavRailLogoIcon}
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            {/* Revy "R" mark - simplified geometric design */}
            <path d="M7 4h6a4 4 0 0 1 0 8H7V4z" />
            <path d="M7 12h3l4 8" />
            <path d="M7 4v16" />
          </svg>
        )}
      </button>
    );
  }
);
NavRailLogo.displayName = 'NavRailLogo';

// ============================================================================
// NAV RAIL DIVIDER
// ============================================================================

export function NavRailDivider() {
  return <div className={css.NavRailDivider} role="separator" />;
}

// ============================================================================
// NAV RAIL SPACER
// ============================================================================

export function NavRailSpacer() {
  return <div className={css.NavRailSpacer} />;
}

// ============================================================================
// NAV RAIL ITEM
// ============================================================================

export const NavRailItem = forwardRef<HTMLButtonElement, NavRailItemProps>(
  (
    {
      icon,
      label,
      shortcut,
      active = false,
      badge,
      badgeVariant = 'default',
      variant = 'default',
      className,
      ...props
    },
    ref
  ) => {
    const [showTooltip, setShowTooltip] = useState(false);

    const handleMouseEnter = useCallback(() => {
      setShowTooltip(true);
    }, []);

    const handleMouseLeave = useCallback(() => {
      setShowTooltip(false);
    }, []);

    const hasBadgeCount = typeof badge === 'number' && badge > 0;
    const showBadge = badge === true || hasBadgeCount;
    const badgeText = hasBadgeCount ? (badge > 99 ? '99+' : String(badge)) : undefined;

    return (
      <button
        ref={ref}
        className={classNames(css.NavRailItem({ active, variant }), className)}
        type="button"
        aria-label={label}
        aria-current={active ? 'page' : undefined}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        onFocus={handleMouseEnter}
        onBlur={handleMouseLeave}
        {...props}
      >
        <span className={css.NavRailItemIcon}>{icon}</span>

        {showBadge && (
          <span
            className={css.NavRailBadge({ hasCount: hasBadgeCount, variant: badgeVariant })}
            aria-label={badgeText ? `${badgeText} unread` : 'Has updates'}
          >
            {badgeText}
          </span>
        )}

        {showTooltip && (
          <span className={css.NavRailTooltip} role="tooltip">
            {label}
            {shortcut && <span className={css.NavRailTooltipShortcut}>{shortcut}</span>}
          </span>
        )}
      </button>
    );
  }
);
NavRailItem.displayName = 'NavRailItem';

// ============================================================================
// NAV RAIL AVATAR
// ============================================================================

export const NavRailAvatar = forwardRef<HTMLButtonElement, NavRailAvatarProps>(
  ({ src, alt = 'User', fallback, presence, size = 'md', className, ...props }, ref) => {
    const [imageError, setImageError] = useState(false);
    const [showTooltip, setShowTooltip] = useState(false);

    const handleImageError = useCallback(() => {
      setImageError(true);
    }, []);

    const handleMouseEnter = useCallback(() => {
      setShowTooltip(true);
    }, []);

    const handleMouseLeave = useCallback(() => {
      setShowTooltip(false);
    }, []);

    // Generate initials from alt text
    const initials =
      fallback ||
      alt
        .split(' ')
        .map((word) => word[0])
        .join('')
        .substring(0, 2)
        .toUpperCase();

    return (
      <button
        ref={ref}
        className={classNames(css.NavRailAvatar({ size }), className)}
        type="button"
        aria-label={alt}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        onFocus={handleMouseEnter}
        onBlur={handleMouseLeave}
        {...props}
      >
        {src && !imageError ? (
          <img
            className={css.NavRailAvatarImage}
            src={src}
            alt={alt}
            onError={handleImageError}
          />
        ) : (
          <div
            style={{
              width: '100%',
              height: '100%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: '#6366F1',
              color: '#FFFFFF',
              fontSize: size === 'sm' ? '10px' : size === 'md' ? '12px' : '14px',
              fontWeight: 600,
            }}
          >
            {initials}
          </div>
        )}

        {presence && <span className={css.NavRailPresence({ status: presence })} />}

        {showTooltip && (
          <span className={css.NavRailTooltip} role="tooltip">
            {alt}
          </span>
        )}
      </button>
    );
  }
);
NavRailAvatar.displayName = 'NavRailAvatar';

// ============================================================================
// NAV RAIL COMMAND TRIGGER
// ============================================================================

interface NavRailCommandTriggerProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  shortcut?: string;
}

export const NavRailCommandTrigger = forwardRef<HTMLButtonElement, NavRailCommandTriggerProps>(
  ({ shortcut = '⌘K', className, ...props }, ref) => {
    return (
      <button
        ref={ref}
        className={classNames(css.NavRailCommandTrigger, className)}
        type="button"
        aria-label="Open command palette"
        {...props}
      >
        {shortcut}
      </button>
    );
  }
);
NavRailCommandTrigger.displayName = 'NavRailCommandTrigger';

// ============================================================================
// EXPORTS
// ============================================================================

export default NavRail;
