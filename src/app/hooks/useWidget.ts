/**
 * Widget state management hook
 * Manages widget visibility and lifecycle
 */

import { useState, useCallback, useRef } from 'react';
import { IApp } from '../../types/widget';
import { WidgetMessaging, createWidgetMessaging } from '../features/widget/WidgetMessaging';
import { useMatrixClient } from './useMatrixClient';

export interface UseWidgetResult {
  activeWidget: IApp | null;
  isWidgetVisible: boolean;
  showWidget: (widget: IApp) => void;
  hideWidget: () => void;
  widgetMessaging: WidgetMessaging | null;
  handleWidgetLoad: (iframe: HTMLIFrameElement) => void;
}

export function useWidget(): UseWidgetResult {
  const mx = useMatrixClient();
  const [activeWidget, setActiveWidget] = useState<IApp | null>(null);
  const [widgetMessaging, setWidgetMessaging] = useState<WidgetMessaging | null>(null);
  const messagingRef = useRef<WidgetMessaging | null>(null);

  const showWidget = useCallback((widget: IApp) => {
    console.log('Showing widget:', widget.name, widget.url);
    setActiveWidget(widget);
  }, []);

  const hideWidget = useCallback(() => {
    console.log('Hiding widget');
    
    // Clean up widget messaging
    if (messagingRef.current) {
      messagingRef.current.stop();
      messagingRef.current = null;
    }
    
    setWidgetMessaging(null);
    setActiveWidget(null);
  }, []);

  const handleWidgetLoad = useCallback(async (iframe: HTMLIFrameElement) => {
    if (!activeWidget) return;

    try {
      console.log('Widget iframe loaded, initializing API...');
      const messaging = await createWidgetMessaging(activeWidget, iframe, mx);
      messagingRef.current = messaging;
      setWidgetMessaging(messaging);
      console.log('Widget API initialized successfully');
    } catch (error) {
      console.error('Failed to initialize widget API:', error);
    }
  }, [activeWidget, mx]);

  return {
    activeWidget,
    isWidgetVisible: activeWidget !== null,
    showWidget,
    hideWidget,
    widgetMessaging,
    handleWidgetLoad,
  };
}
