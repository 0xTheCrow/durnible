/**
 * Element Call integration utilities
 * Based on Element Web's Call.ts implementation
 */

import { MatrixClient, Room } from 'matrix-js-sdk';
import { secureRandomString } from 'matrix-js-sdk/lib/randomstring';
import { IApp, ElementCallIntent, WidgetGenerationParameters, WIDGET_TYPE } from '../../../types/widget';

/**
 * Get the current language for Element Call
 */
function getCurrentLanguage(): string {
  return navigator.language || 'en';
}

/**
 * Get browser default font size
 */
function getBrowserDefaultFontSize(): number {
  return 16; // Standard browser default
}

/**
 * Get current root font size
 */
function getRootFontSize(): number {
  return parseFloat(getComputedStyle(document.documentElement).fontSize);
}

/**
 * Check if a room is a DM room
 */
function isDMRoom(client: MatrixClient, roomId: string): boolean {
  const mDirectEvent = client.getAccountData('m.direct' as any);
  if (!mDirectEvent) return false;
  
  const mDirect = mDirectEvent.getContent();
  // Check if roomId is in any of the DM lists
  for (const userId in mDirect) {
    const rooms = mDirect[userId];
    if (Array.isArray(rooms) && rooms.includes(roomId)) {
      return true;
    }
  }
  return false;
}

/**
 * Check if there's an ongoing call in the room
 */
export function hasOngoingCall(room: Room): boolean {
  try {
    const rtcSession = room.client.matrixRTC?.getRoomSession(room);
    if (!rtcSession) return false;
    
    const memberships = rtcSession.memberships;
    return memberships && memberships.length > 0;
  } catch (error) {
    // MatrixRTC might not be available
    return false;
  }
}

/**
 * Determine the correct intent for an Element Call
 */
function calculateIntent(
  client: MatrixClient,
  roomId: string,
  opts: WidgetGenerationParameters = {}
): ElementCallIntent {
  const room = client.getRoom(roomId);
  if (!room) {
    return ElementCallIntent.StartCall;
  }

  const isDM = isDMRoom(client, roomId);
  const { voiceOnly = false } = opts;

  try {
    const rtcSession = client.matrixRTC?.getRoomSession(room);
    const oldestMembership = rtcSession?.getOldestMembership?.();
    const hasCallStarted = !!oldestMembership && oldestMembership.sender !== client.getSafeUserId();

    if (isDM) {
      if (hasCallStarted) {
        return voiceOnly ? ElementCallIntent.JoinExistingDMVoice : ElementCallIntent.JoinExistingDM;
      } else {
        return voiceOnly ? ElementCallIntent.StartCallDMVoice : ElementCallIntent.StartCallDM;
      }
    } else {
      // Group calls don't have voice-only option
      return hasCallStarted ? ElementCallIntent.JoinExisting : ElementCallIntent.StartCall;
    }
  } catch (error) {
    // If MatrixRTC is not available, default to starting a call
    return ElementCallIntent.StartCall;
  }
}

/**
 * Generate the Element Call widget URL
 */
export function generateElementCallUrl(
  client: MatrixClient,
  roomId: string,
  widgetId: string,
  opts: WidgetGenerationParameters = {}
): URL {
  // Use Element Call embedded
  // In dev, serve directly from node_modules to avoid static copy issues
  // In prod, serve from the copied assets directory
  const basePath = import.meta.env.DEV
    ? '/node_modules/@element-hq/element-call-embedded/dist'
    : '/assets/element-call';
  const url = new URL(`${window.location.origin}${basePath}/index.html`);
  
  // Add widget parameters as query params (before the hash)
  // These tell Element Call it's running as a widget
  url.searchParams.set('widgetId', widgetId);
  url.searchParams.set('parentUrl', window.location.origin + window.location.pathname);
  
  // Element Call expects parameters in the URL hash
  // Template variables like $perParticipantE2EE are replaced by widget data
  const params = new URLSearchParams({
    perParticipantE2EE: '$perParticipantE2EE',
    userId: client.getUserId()!,
    deviceId: client.getDeviceId()!,
    roomId: roomId,
    baseUrl: client.baseUrl,
    lang: getCurrentLanguage().replace('_', '-'),
    fontScale: (getRootFontSize() / getBrowserDefaultFontSize()).toString(),
    theme: '$org.matrix.msc2873.client_theme',
    debug: 'true', // Enable debug logging
  });

  // Set skip lobby if specified
  if (typeof opts.skipLobby === 'boolean') {
    params.set('skipLobby', opts.skipLobby.toString());
  }

  // Calculate intent
  const intent = calculateIntent(client, roomId, opts);
  params.set('intent', intent);

  // Element Call reads params from hash
  // Replace %24 with $ for template variables
  const replacedUrl = params.toString().replace(/%24/g, '$');
  url.hash = `#?${replacedUrl}`;

  console.log('Generated Element Call URL:', url.toString());
  console.log('Widget ID:', widgetId);
  console.log('Room ID:', roomId);

  return url;
}

/**
 * Get widget data for Element Call
 */
function getWidgetData(client: MatrixClient, roomId: string): Record<string, any> {
  return {
    // Widget data that Element Call expects
    perParticipantE2EE: true,
    'org.matrix.msc2873.client_theme': 'dark', // or 'light' based on user preference
  };
}

/**
 * Create or get the Element Call widget for a room
 */
export function createElementCallWidget(
  client: MatrixClient,
  roomId: string,
  opts: WidgetGenerationParameters = {}
): IApp {
  const widgetId = `ec-${secureRandomString(16)}`;
  const url = generateElementCallUrl(client, roomId, widgetId, opts);
  
  return {
    id: widgetId,
    type: WIDGET_TYPE.CALL,
    url: url.toString(),
    name: 'Element Call',
    roomId: roomId,
    creatorUserId: client.getUserId()!,
    data: getWidgetData(client, roomId),
    waitForIframeLoad: false,
  };
}

/**
 * Check if user has permission to start calls in a room
 */
export function canStartCall(room: Room): boolean {
  const powerLevels = room.currentState.getStateEvents('m.room.power_levels', '');
  if (!powerLevels) return true; // No power levels = anyone can call
  
  const content = powerLevels.getContent();
  const userId = room.client.getUserId();
  if (!userId) return false;
  
  const userPowerLevel = content.users?.[userId] ?? content.users_default ?? 0;
  
  // Check permission to send the call member state event
  const requiredLevel = content.events?.['org.matrix.msc3401.call.member'] ?? 
                       content.state_default ?? 
                       50;
  
  return userPowerLevel >= requiredLevel;
}
