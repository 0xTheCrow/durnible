/**
 * Revy Toast Notification Components
 * Premium notification toasts for Revy Comms
 */

import React, {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  useMemo,
  ReactNode,
} from 'react';
import { createPortal } from 'react-dom';
import classNames from 'classnames';
import * as css from './RevyToast.css';

// ============================================================================
// ICONS
// ============================================================================

const XIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M18 6 6 18" />
    <path d="m6 6 12 12" />
  </svg>
);

const CheckIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="20 6 9 17 4 12" />
  </svg>
);

const AlertTriangleIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" />
    <path d="M12 9v4" />
    <path d="M12 17h.01" />
  </svg>
);

const AlertCircleIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10" />
    <line x1="12" x2="12" y1="8" y2="12" />
    <line x1="12" x2="12.01" y1="16" y2="16" />
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

// ============================================================================
// TYPES
// ============================================================================

export type ToastVariant = 'message' | 'success' | 'warning' | 'error' | 'ai';

export interface ToastAction {
  label: string;
  onClick: () => void;
  primary?: boolean;
}

export interface Toast {
  id: string;
  variant: ToastVariant;
  title: string;
  subtitle?: string;
  message?: string;
  avatar?: string;
  actions?: ToastAction[];
  duration?: number;
  onClick?: () => void;
  onClose?: () => void;
}

interface ToastContextValue {
  toasts: Toast[];
  addToast: (toast: Omit<Toast, 'id'>) => string;
  removeToast: (id: string) => void;
  clearAll: () => void;
}

// ============================================================================
// CONTEXT
// ============================================================================

const ToastContext = createContext<ToastContextValue | null>(null);

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
}

// ============================================================================
// PROVIDER
// ============================================================================

interface ToastProviderProps {
  children: ReactNode;
  maxVisible?: number;
}

export function ToastProvider({ children, maxVisible = 3 }: ToastProviderProps) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [exitingIds, setExitingIds] = useState<Set<string>>(new Set());

  const addToast = useCallback((toast: Omit<Toast, 'id'>) => {
    const id = `toast-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    setToasts((prev) => [...prev, { ...toast, id }]);
    return id;
  }, []);

  const removeToast = useCallback((id: string) => {
    setExitingIds((prev) => new Set(prev).add(id));
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
      setExitingIds((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    }, 150);
  }, []);

  const clearAll = useCallback(() => {
    toasts.forEach((t) => removeToast(t.id));
  }, [toasts, removeToast]);

  const value = useMemo(
    () => ({ toasts, addToast, removeToast, clearAll }),
    [toasts, addToast, removeToast, clearAll]
  );

  const visibleToasts = toasts.slice(-maxVisible);
  const hiddenCount = toasts.length - maxVisible;

  const portalContainer = typeof document !== 'undefined'
    ? document.getElementById('portalContainer') || document.body
    : null;

  return (
    <ToastContext.Provider value={value}>
      {children}
      {portalContainer && createPortal(
        <div className={css.ToastContainer}>
          {visibleToasts.map((toast) => (
            <ToastItem
              key={toast.id}
              toast={toast}
              exiting={exitingIds.has(toast.id)}
              onClose={() => removeToast(toast.id)}
            />
          ))}
          {hiddenCount > 0 && (
            <div className={css.ToastStackIndicator}>
              +{hiddenCount} more notification{hiddenCount > 1 ? 's' : ''}
            </div>
          )}
        </div>,
        portalContainer
      )}
    </ToastContext.Provider>
  );
}

// ============================================================================
// TOAST ITEM
// ============================================================================

interface ToastItemProps {
  toast: Toast;
  exiting: boolean;
  onClose: () => void;
}

function ToastItem({ toast, exiting, onClose }: ToastItemProps) {
  const [isPaused, setIsPaused] = useState(false);
  const [progress, setProgress] = useState(100);
  const duration = toast.duration ?? 5000;

  // Auto-dismiss timer
  useEffect(() => {
    if (isPaused || duration === 0) return;

    const startTime = Date.now();
    const interval = setInterval(() => {
      const elapsed = Date.now() - startTime;
      const remaining = Math.max(0, 100 - (elapsed / duration) * 100);
      setProgress(remaining);

      if (remaining === 0) {
        onClose();
      }
    }, 50);

    return () => clearInterval(interval);
  }, [duration, isPaused, onClose]);

  // Get avatar content
  const getAvatarContent = () => {
    if (toast.avatar) {
      return <img className={css.ToastAvatarImage} src={toast.avatar} alt="" />;
    }

    switch (toast.variant) {
      case 'success':
        return (
          <span className={css.ToastAvatarIcon}>
            <CheckIcon />
          </span>
        );
      case 'warning':
        return (
          <span className={css.ToastAvatarIcon}>
            <AlertTriangleIcon />
          </span>
        );
      case 'error':
        return (
          <span className={css.ToastAvatarIcon}>
            <AlertCircleIcon />
          </span>
        );
      case 'ai':
        return (
          <span className={css.ToastAvatarIcon}>
            <BotIcon />
          </span>
        );
      default:
        return toast.title[0]?.toUpperCase() || '?';
    }
  };

  const getAvatarVariant = (): css.ToastAvatarVariants['variant'] => {
    switch (toast.variant) {
      case 'success':
        return 'success';
      case 'warning':
        return 'warning';
      case 'error':
        return 'error';
      case 'ai':
        return 'ai';
      default:
        return 'user';
    }
  };

  return (
    <div
      className={css.Toast({ exiting, variant: toast.variant })}
      onClick={toast.onClick}
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
      role="alert"
    >
      {/* Avatar */}
      <div className={css.ToastAvatar({ variant: getAvatarVariant() })}>
        {getAvatarContent()}
      </div>

      {/* Content */}
      <div className={css.ToastContent}>
        <div className={css.ToastHeader}>
          <span className={css.ToastTitle}>{toast.title}</span>
          {toast.subtitle && <span className={css.ToastSubtitle}>{toast.subtitle}</span>}
        </div>
        {toast.message && <div className={css.ToastMessage}>{toast.message}</div>}

        {/* Actions */}
        {toast.actions && toast.actions.length > 0 && (
          <div className={css.ToastActions}>
            {toast.actions.map((action, i) => (
              <button
                key={i}
                className={css.ToastAction({ variant: action.primary ? 'primary' : 'default' })}
                onClick={(e) => {
                  e.stopPropagation();
                  action.onClick();
                }}
                type="button"
              >
                {action.label}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Close Button */}
      <button
        className={css.ToastClose}
        onClick={(e) => {
          e.stopPropagation();
          toast.onClose?.();
          onClose();
        }}
        type="button"
        aria-label="Close notification"
      >
        <span className={css.ToastCloseIcon}>
          <XIcon />
        </span>
      </button>

      {/* Progress Bar */}
      {duration > 0 && (
        <div className={css.ToastProgress}>
          <div
            className={css.ToastProgressBar({ variant: toast.variant })}
            style={{
              width: `${progress}%`,
              transitionDuration: isPaused ? '0ms' : '50ms',
            }}
          />
        </div>
      )}
    </div>
  );
}

// ============================================================================
// HELPER HOOKS
// ============================================================================

export function useMessageToast() {
  const { addToast } = useToast();

  return useCallback(
    (
      title: string,
      message: string,
      options?: { subtitle?: string; avatar?: string; onClick?: () => void }
    ) => {
      return addToast({
        variant: 'message',
        title,
        message,
        ...options,
      });
    },
    [addToast]
  );
}

export function useSuccessToast() {
  const { addToast } = useToast();

  return useCallback(
    (title: string, message?: string) => {
      return addToast({
        variant: 'success',
        title,
        message,
        duration: 3000,
      });
    },
    [addToast]
  );
}

export function useErrorToast() {
  const { addToast } = useToast();

  return useCallback(
    (title: string, message?: string) => {
      return addToast({
        variant: 'error',
        title,
        message,
        duration: 8000,
      });
    },
    [addToast]
  );
}

export function useAIToast() {
  const { addToast } = useToast();

  return useCallback(
    (
      title: string,
      message?: string,
      actions?: ToastAction[]
    ) => {
      return addToast({
        variant: 'ai',
        title,
        message,
        actions,
        duration: 0, // AI toasts don't auto-dismiss
      });
    },
    [addToast]
  );
}

// ============================================================================
// EXPORTS
// ============================================================================

export default ToastProvider;
