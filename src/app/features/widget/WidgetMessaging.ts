/**
 * Widget API Bridge
 * Handles communication between Cinny and embedded widgets using matrix-widget-api
 */

import { ClientWidgetApi, Widget, WidgetApiFromWidgetAction } from 'matrix-widget-api';
import { MatrixClient } from 'matrix-js-sdk';
import { IApp } from '../../../types/widget';
import { CinnyWidgetDriver } from './CinnyWidgetDriver';

/**
 * Convert IApp to Widget type required by matrix-widget-api
 */
function toWidget(app: IApp): Widget {
  return new Widget({
    id: app.id,
    creatorUserId: app.creatorUserId || '',
    type: app.type,
    url: app.url,
    name: app.name,
    data: app.data || {},
    // roomId is not part of IWidget interface, it's handled by the driver
    // avatar_url is not part of IWidget interface
  });
}

export class WidgetMessaging {
  private widgetApi: ClientWidgetApi | null = null;
  private iframe: HTMLIFrameElement;
  private widget: IApp;
  private client: MatrixClient;

  constructor(widget: IApp, iframe: HTMLIFrameElement, client: MatrixClient) {
    this.widget = widget;
    this.iframe = iframe;
    this.client = client;
  }

  /**
   * Initialize the widget API and start communication
   */
  async start(): Promise<void> {
    if (!this.iframe.contentWindow) {
      throw new Error('Iframe not ready');
    }

    try {
      // Convert IApp to Widget
      const widgetDef = toWidget(this.widget);

      // Create widget driver with capabilities
      const driver = new CinnyWidgetDriver(
        this.client,
        this.widget.roomId,
        this.widget.id
      );

      // Create ClientWidgetApi (host-side API)
      this.widgetApi = new ClientWidgetApi(
        widgetDef,
        this.iframe,
        driver
      );

      console.log('Widget API started successfully for:', this.widget.name);
      console.log('Widget can now authenticate with Matrix');
    } catch (error) {
      console.error('Failed to start widget API:', error);
      throw error;
    }
  }

  /**
   * Stop the widget and clean up
   */
  stop(): void {
    // ClientWidgetApi doesn't have a stop method, just set to null
    this.widgetApi = null;
    console.log('Widget stopped:', this.widget.name);
  }

  /**
   * Get the widget API instance
   */
  getApi(): ClientWidgetApi | null {
    return this.widgetApi;
  }
}

/**
 * Create and initialize widget messaging
 */
export async function createWidgetMessaging(
  widget: IApp,
  iframe: HTMLIFrameElement,
  client: MatrixClient
): Promise<WidgetMessaging> {
  const messaging = new WidgetMessaging(widget, iframe, client);
  await messaging.start();
  return messaging;
}
