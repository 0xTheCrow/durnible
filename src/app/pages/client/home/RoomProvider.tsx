import type { ReactNode } from 'react';
import React from 'react';
import { useParams } from 'react-router-dom';
import { useSelectedRoom } from '../../../hooks/router/useSelectedRoom';
import { IsDirectRoomProvider, RoomProvider } from '../../../hooks/useRoom';
import { useMatrixClient } from '../../../hooks/useMatrixClient';
import { JoinBeforeNavigate } from '../../../features/join-before-navigate';
import { useHomeRooms } from './useHomeRooms';
import { useSearchParamsViaServers } from '../../../hooks/router/useSearchParamsViaServers';
import { ROUTE_GATE_DEADLINE_MS, useReadinessGate } from '../../../state/readiness';

export function HomeRouteRoomProvider({ children }: { children: ReactNode }) {
  const mx = useMatrixClient();
  const rooms = useHomeRooms();

  const { roomIdOrAlias, eventId } = useParams();
  const viaServers = useSearchParamsViaServers();
  const roomId = useSelectedRoom();
  const room = mx.getRoom(roomId);

  const isJoinedRoom = !!room && rooms.includes(room.roomId);
  useReadinessGate('route', !roomIdOrAlias || isJoinedRoom, ROUTE_GATE_DEADLINE_MS);

  if (!roomIdOrAlias) return null;

  if (!isJoinedRoom) {
    return (
      <JoinBeforeNavigate roomIdOrAlias={roomIdOrAlias} eventId={eventId} viaServers={viaServers} />
    );
  }

  return (
    <RoomProvider key={room.roomId} value={room}>
      <IsDirectRoomProvider value={false}>{children}</IsDirectRoomProvider>
    </RoomProvider>
  );
}
