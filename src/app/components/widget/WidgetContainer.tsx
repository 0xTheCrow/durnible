/**
 * Widget Container Component
 * Displays widgets (like Element Call) in an iframe overlay
 */

import React, { useEffect, useRef, useState } from 'react';
import { Box, IconButton, Icon, Icons, Text, Spinner } from 'folds';
import { IApp } from '../../../types/widget';
import * as css from './WidgetContainer.css';

export interface WidgetContainerProps {
  widget: IApp;
  onClose: () => void;
  onLoad?: (iframe: HTMLIFrameElement) => void;
}

export function WidgetContainer({ widget, onClose, onLoad }: WidgetContainerProps) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [onClose]);

  // Initialize widget API as soon as iframe is mounted
  // This prevents race conditions where the widget sends capabilities request before we're listening
  useEffect(() => {
    if (iframeRef.current && onLoad) {
      onLoad(iframeRef.current);
    }
  }, [onLoad]);

  const handleIframeLoad = () => {
    setIsLoading(false);
    setError(null);
  };

  const handleIframeError = () => {
    setIsLoading(false);
    setError('Failed to load widget');
  };

  const handleOverlayClick = (e: React.MouseEvent) => {
    // Close if clicking the overlay background (not the container)
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  return (
    <div className={css.WidgetOverlay} onClick={handleOverlayClick}>
      <div className={css.WidgetContainer}>
        <div className={css.WidgetHeader}>
          <Text className={css.WidgetTitle}>{widget.name || 'Widget'}</Text>
          <IconButton onClick={onClose} aria-label="Close widget">
            <Icon src={Icons.Cross} size="400" />
          </IconButton>
        </div>

        {isLoading && (
          <div className={css.LoadingContainer}>
            <Spinner variant="Secondary" size="600" />
            <Text>Loading {widget.name}...</Text>
          </div>
        )}

        {error && (
          <div className={css.LoadingContainer}>
            <Icon src={Icons.Warning} size="600" />
            <Text>{error}</Text>
          </div>
        )}

        <iframe
          ref={iframeRef}
          src={widget.url}
          className={css.WidgetIframe}
          title={widget.name || 'Widget'}
          sandbox="allow-forms allow-scripts allow-same-origin allow-popups allow-popups-to-escape-sandbox allow-downloads"
          allow="camera; microphone; display-capture; fullscreen"
          onLoad={handleIframeLoad}
          onError={handleIframeError}
          style={{ display: isLoading ? 'none' : 'block' }}
        />
      </div>
    </div>
  );
}
