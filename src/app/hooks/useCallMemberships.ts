import { useEffect, useState } from 'react';
import type { Room } from 'matrix-js-sdk';
import type { CallMembership } from 'matrix-js-sdk/lib/matrixrtc';
import { MatrixRTCSessionEvent } from 'matrix-js-sdk/lib/matrixrtc';
import { useMatrixClient } from './useMatrixClient';

export const useCallMemberships = (room: Room): CallMembership[] => {
  const mx = useMatrixClient();
  const [memberships, setMemberships] = useState<CallMembership[]>(
    () => mx.matrixRTC.getRoomSession(room).memberships
  );
  const [prev, setPrev] = useState({ mx, room });
  if (prev.mx !== mx || prev.room !== room) {
    setPrev({ mx, room });
    setMemberships(mx.matrixRTC.getRoomSession(room).memberships);
  }

  useEffect(() => {
    const rtcSession = mx.matrixRTC.getRoomSession(room);
    const handleMembershipsChanged = (
      oldMemberships: CallMembership[],
      newMemberships: CallMembership[]
    ) => {
      setMemberships(newMemberships);
    };
    rtcSession.on(MatrixRTCSessionEvent.MembershipsChanged, handleMembershipsChanged);
    return () => {
      rtcSession.off(MatrixRTCSessionEvent.MembershipsChanged, handleMembershipsChanged);
    };
  }, [mx, room]);

  return memberships;
};
