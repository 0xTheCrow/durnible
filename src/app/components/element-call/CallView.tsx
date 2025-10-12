import React, { useEffect, useRef, useState } from 'react';
import { ClientWidgetApi } from 'matrix-widget-api';
import { Button, Text } from 'folds';
import ElementCall from './ElementCall';
import { useMatrixClient } from '../../hooks/useMatrixClient';
import { useEventEmitter } from './utils';
import { useIsDirectRoom, useRoom } from '../../hooks/useRoom';
import { useCallOngoing } from '../../hooks/useCallOngoing';

export enum CallWidgetActions {
  // All of these actions are currently specific to Jitsi and Element Call
  JoinCall = 'io.element.join',
  HangupCall = 'im.vector.hangup',
  Close = 'io.element.close',
}
export function action(type: CallWidgetActions): string {
  return `action:${type}`;
}

const iframeFeatures =
  'microphone; camera; encrypted-media; autoplay; display-capture; clipboard-write; ' +
  'clipboard-read;';
const sandboxFlags =
  'allow-forms allow-popups allow-popups-to-escape-sandbox ' +
  'allow-same-origin allow-scripts allow-presentation allow-downloads';
const iframeStyles = { flex: '1 1', border: 'none' };
const containerStyle = (hidden: boolean): React.CSSProperties => ({
  display: 'flex',
  flexDirection: 'column',
  position: 'relative',
  height: '100%',
  width: '100%',
  ...(hidden
    ? {
        overflow: 'hidden',
        width: 0,
        height: 0,
      }
    : {}),
});
const closeButtonStyle: React.CSSProperties = {
  position: 'absolute',
  top: 8,
  right: 8,
  zIndex: 100,
  maxWidth: 'fit-content',
};

enum State {
  Preparing = 'preparing',
  Lobby = 'lobby',
  Joined = 'joined',
  HungUp = 'hung_up',
  CanClose = 'can_close',
}

/**
 * Shows a call for this room. Rendering this component will
 * automatically create a call widget and join the call in the room.
 * @returns
 */
export interface IRoomCallViewProps {
  onClose?: () => void;
  onJoin?: () => void;
  onHangup?: (errorMessage?: string) => void;
}

export function CallView({
  onJoin = undefined,
  onClose = undefined,
  onHangup = undefined,
}: IRoomCallViewProps): JSX.Element {}
