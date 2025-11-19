/**
 * React hook for Element Call integration
 */

import { Room } from 'matrix-js-sdk';
import { useCallback, useMemo, useState } from 'react';
import { useMatrixClient } from './useMatrixClient';
import {
  canStartCall,
  createElementCallWidget,
  hasOngoingCall,
} from '../features/calls/elementCall';
import { IApp } from '../../types/widget';

export interface UseElementCallResult {
  /** Whether Element Call is supported in this room */
  canCall: boolean;
  /** Reason why calling is disabled, if any */
  disabledReason: string | null;
  /** Whether there's an active call */
  hasActiveCall: boolean;
  /** Start or join an Element Call */
  startCall: () => void;
  /** Whether the call is currently being initiated */
  isInitiating: boolean;
}

/**
 * Hook to manage Element Call state and actions for a room
 */
export function useElementCall(
  room: Room,
  showWidget: (widget: IApp) => void
): UseElementCallResult {
  const mx = useMatrixClient();
  const [isInitiating, setIsInitiating] = useState(false);

  // Check if user has permission to start calls
  const hasPermission = useMemo(() => canStartCall(room), [room]);

  // Check if there's an ongoing call
  const hasActiveCall = useMemo(() => hasOngoingCall(room), [room]);

  // Determine if calling is disabled and why
  const disabledReason = useMemo(() => {
    if (!hasPermission) {
      return 'You do not have permission to start calls in this room';
    }
    
    const memberCount = room.getJoinedMemberCount();
    if (memberCount === 1) {
      return 'You are the only person in this room';
    }
    
    return null;
  }, [hasPermission, room]);

  // Can call if no disabled reason
  const canCall = disabledReason === null;

  // Start or join a call
  const startCall = useCallback(() => {
    if (!canCall) return;

    setIsInitiating(true);
    
    try {
      // Create the Element Call widget
      const callWidget = createElementCallWidget(mx, room.roomId, {
        skipLobby: false,
        voiceOnly: false,
      });
      
      // Show the widget in an embedded iframe
      showWidget(callWidget);
    } catch (error) {
      console.error('Failed to start Element Call:', error);
    } finally {
      setIsInitiating(false);
    }
  }, [canCall, mx, room.roomId, showWidget]);

  return {
    canCall,
    disabledReason,
    hasActiveCall,
    startCall,
    isInitiating,
  };
}
