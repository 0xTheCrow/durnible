/**
 * Widget Driver for Cinny
 * Simplified version of Element Web's StopGapWidgetDriver
 * Handles widget capabilities and authentication
 */

import {
  WidgetDriver,
  type Capability,
  type IOpenIDCredentials,
  type IOpenIDUpdate,
  type SimpleObservable,
  OpenIDRequestState,
  MatrixCapabilities,
  WidgetEventCapability,
  EventDirection,
  ISendEventDetails,
} from 'matrix-widget-api';
import { MatrixClient, EventType, Direction } from 'matrix-js-sdk';

export class CinnyWidgetDriver extends WidgetDriver {
  private allowedCapabilities: Set<Capability>;

  constructor(
    private client: MatrixClient,
    private roomId: string,
    private widgetId: string
  ) {
    super();

    // Set up capabilities for Element Call
    this.allowedCapabilities = new Set([
      // Always allow screenshots
      MatrixCapabilities.Screenshots,
      MatrixCapabilities.AlwaysOnScreen,
      MatrixCapabilities.MSC3846TurnServers,
      
      // Timeline access for the room
      `org.matrix.msc2762.timeline:${roomId}`,
      
      // State events - receive
      WidgetEventCapability.forStateEvent(EventDirection.Receive, EventType.RoomName).raw,
      WidgetEventCapability.forStateEvent(EventDirection.Receive, EventType.RoomMember).raw,
      WidgetEventCapability.forStateEvent(EventDirection.Receive, 'org.matrix.msc3401.call').raw,
      WidgetEventCapability.forStateEvent(EventDirection.Receive, 'org.matrix.msc3401.call.member').raw,
      WidgetEventCapability.forStateEvent(EventDirection.Receive, EventType.RoomEncryption).raw,
      WidgetEventCapability.forStateEvent(EventDirection.Receive, EventType.RoomCreate).raw,
    ]);

    // Add send capabilities for call member state
    const userId = client.getUserId();
    const deviceId = client.getDeviceId();
    
    if (userId) {
      // Legacy membership type
      this.allowedCapabilities.add(
        WidgetEventCapability.forStateEvent(EventDirection.Send, 'org.matrix.msc3401.call.member', userId).raw
      );
      
      if (deviceId) {
        // Session membership types (MSC4143)
        const sessionKeys = [
          `_${userId}_${deviceId}`,
          `_${userId}_${deviceId}_m.call`,
          `${userId}_${deviceId}`,
          `${userId}_${deviceId}_m.call`,
        ];
        
        sessionKeys.forEach(key => {
          this.allowedCapabilities.add(
            WidgetEventCapability.forStateEvent(EventDirection.Send, 'org.matrix.msc3401.call.member', key).raw
          );
        });
      }
    }

    // Room events for calls
    const sendRoomEvents = [EventType.CallNotify];
    const sendRecvRoomEvents = [
      'io.element.call.encryption_keys',
      EventType.Reaction,
      EventType.RoomRedaction,
      'io.element.call.reaction',
    ];
    
    sendRoomEvents.forEach(eventType => {
      this.allowedCapabilities.add(WidgetEventCapability.forRoomEvent(EventDirection.Send, eventType).raw);
    });
    
    sendRecvRoomEvents.forEach(eventType => {
      this.allowedCapabilities.add(WidgetEventCapability.forRoomEvent(EventDirection.Send, eventType).raw);
      this.allowedCapabilities.add(WidgetEventCapability.forRoomEvent(EventDirection.Receive, eventType).raw);
    });

    // To-device events for call signaling
    const toDeviceEvents = [
      EventType.CallInvite,
      EventType.CallCandidates,
      EventType.CallAnswer,
      EventType.CallHangup,
      EventType.CallReject,
      EventType.CallSelectAnswer,
      EventType.CallNegotiate,
      'org.matrix.call.sdp_stream_metadata_changed',
      'm.call.sdp_stream_metadata_changed',
      'm.call.replaces',
      'io.element.call.encryption_keys',
    ];
    
    toDeviceEvents.forEach(eventType => {
      this.allowedCapabilities.add(WidgetEventCapability.forToDeviceEvent(EventDirection.Send, eventType).raw);
      this.allowedCapabilities.add(WidgetEventCapability.forToDeviceEvent(EventDirection.Receive, eventType).raw);
    });
  }

  public async validateCapabilities(requested: Set<Capability>): Promise<Set<Capability>> {
    console.log('Widget requested capabilities:', Array.from(requested));
    // For Element Call, auto-approve all requested capabilities that we support
    const approved = new Set<Capability>();
    
    requested.forEach(cap => {
      if (this.allowedCapabilities.has(cap)) {
        approved.add(cap);
      } else {
        console.warn('Widget requested unsupported capability:', cap);
      }
    });
    
    console.log('Widget capabilities approved:', Array.from(approved));
    return approved;
  }

  public async askOpenID(observer: SimpleObservable<IOpenIDUpdate>): Promise<void> {
    console.log('Widget requested OpenID token');
    // Automatically approve OpenID for Element Call
    try {
      const token: IOpenIDCredentials = await this.client.getOpenIdToken();
      console.log('Received OpenID token from client, sending to widget');
      observer.update({
        state: OpenIDRequestState.Allowed,
        token,
      });
      console.log('OpenID token provided to widget');
    } catch (error) {
      console.error('Failed to get OpenID token:', error);
      observer.update({ state: OpenIDRequestState.Blocked });
    }
  }

  public async readStateEvents(
    eventType: string,
    stateKey: string | undefined
  ): Promise<any[]> {
    console.log(`Widget reading state events: ${eventType} (key: ${stateKey})`);
    const room = this.client.getRoom(this.roomId);
    if (!room) return [];

    const state = room.getLiveTimeline().getState(Direction.Forward);
    if (!state) return [];

    if (stateKey === undefined) {
      return state.getStateEvents(eventType).map(e => e.getEffectiveEvent());
    }
    const event = state.getStateEvents(eventType, stateKey);
    return event ? [event.getEffectiveEvent()] : [];
  }

  public async sendEvent(
    eventType: string,
    content: any,
    stateKey: string | null = null
  ): Promise<ISendEventDetails> {
    console.log(`Widget sending event: ${eventType}`);
    const room = this.client.getRoom(this.roomId);
    if (!room) throw new Error('Room not found');

    let response: { event_id: string };
    if (stateKey !== null) {
      response = await this.client.sendStateEvent(this.roomId, eventType, content, stateKey);
    } else {
      response = await this.client.sendEvent(this.roomId, eventType, content);
    }

    return { eventId: response.event_id, roomId: this.roomId };
  }

  public async sendToDevice(
    eventType: string,
    encrypted: boolean,
    contentMap: { [userId: string]: { [deviceId: string]: object } }
  ): Promise<void> {
    console.log(`Widget sending to-device event: ${eventType} (encrypted: ${encrypted})`);
    
    if (encrypted) {
      const crypto = this.client.getCrypto();
      if (!crypto) throw new Error("E2EE not enabled");

      // Re-batch into a single request
      const invertedContentMap: { [content: string]: { userId: string; deviceId: string }[] } = {};

      for (const userId of Object.keys(contentMap)) {
        const userContentMap = contentMap[userId];
        for (const deviceId of Object.keys(userContentMap)) {
          const content = userContentMap[deviceId];
          const stringifiedContent = JSON.stringify(content);
          invertedContentMap[stringifiedContent] = invertedContentMap[stringifiedContent] || [];
          invertedContentMap[stringifiedContent].push({ userId, deviceId });
        }
      }

      await Promise.all(
        Object.entries(invertedContentMap).map(async ([stringifiedContent, recipients]) => {
          const batch = await crypto.encryptToDeviceMessages(
            eventType,
            recipients,
            JSON.parse(stringifiedContent),
          );
          await this.client.queueToDevice(batch);
        })
      );
    } else {
      await this.client.queueToDevice({
        eventType,
        batch: Object.entries(contentMap).flatMap(([userId, userContentMap]) =>
          Object.entries(userContentMap).map(([deviceId, content]) => ({
            userId,
            deviceId,
            payload: content,
          }))
        ),
      });
    }
  }

  public async readRoomEvents(
    eventType: string,
    msgtype: string | undefined,
    limit: number,
    roomIds: string[] | null = null,
    since: string | undefined
  ): Promise<any[]> {
    console.log(`Widget reading room events: ${eventType}`);
    const room = this.client.getRoom(this.roomId);
    if (!room) return [];

    const results: any[] = [];
    const events = room.getLiveTimeline().getEvents();
    
    for (let i = events.length - 1; i >= 0; i--) {
      const ev = events[i];
      if (results.length >= limit) break;
      if (since !== undefined && ev.getId() === since) break;

      if (ev.getType() !== eventType) continue;
      if (eventType === EventType.RoomMessage && msgtype && msgtype !== ev.getContent()["msgtype"]) continue;
      
      results.push(ev.getEffectiveEvent());
    }

    return results;
  }
}
