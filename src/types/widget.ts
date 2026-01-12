/**
 * Element Call widget and integration types
 */

import { IWidgetData } from 'matrix-widget-api';

/**
 * Widget application interface
 */
export interface IApp {
  id: string;
  roomId: string;
  type: string;
  url: string;
  name?: string;
  data?: IWidgetData;
  creatorUserId?: string;
  avatar_url?: string; 
  waitForIframeLoad?: boolean;
}

/**
 * Element Call intent types
 */
export enum ElementCallIntent {
  StartCall = 'start_call',
  JoinExisting = 'join_existing',
  StartCallDM = 'start_call_dm',
  StartCallDMVoice = 'start_call_dm_voice',
  JoinExistingDM = 'join_existing_dm',
  JoinExistingDMVoice = 'join_existing_dm_voice',
}

/**
 * Widget generation parameters
 */
export interface WidgetGenerationParameters {
  /**
   * Skip showing the lobby screen of a call
   */
  skipLobby?: boolean;
  /**
   * Does the user intent to start a voice call?
   */
  voiceOnly?: boolean;
}

/**
 * Widget type identifiers
 */
export const WIDGET_TYPE = {
  CALL: 'm.call',
  JITSI: 'jitsi',
} as const;

export type WidgetType = typeof WIDGET_TYPE[keyof typeof WIDGET_TYPE];
