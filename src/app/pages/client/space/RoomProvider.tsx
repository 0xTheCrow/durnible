import type { ReactNode } from 'react';
import React from 'react';
import { useParams } from 'react-router-dom';
import { useAtom, useAtomValue } from 'jotai';
import { useSelectedRoom } from '../../../hooks/router/useSelectedRoom';
import { IsDirectRoomProvider, RoomProvider } from '../../../hooks/useRoom';
import { useMatrixClient } from '../../../hooks/useMatrixClient';
import { JoinBeforeNavigate } from '../../../features/join-before-navigate';
import { useSpace } from '../../../hooks/useSpace';
import { getAllParents, getSpaceChildren } from '../../../utils/room';
import { roomToParentsAtom } from '../../../state/room/roomToParents';
import { allRoomsAtom } from '../../../state/room-list/roomList';
import { useSearchParamsViaServers } from '../../../hooks/router/useSearchParamsViaServers';
import { mDirectAtom } from '../../../state/mDirectList';
import { settingsAtom } from '../../../state/settings';
import { useSetting } from '../../../state/hooks/settings';
import { ROUTE_GATE_DEADLINE_MS, useReadinessGate } from '../../../state/readiness';

export function SpaceRouteRoomProvider({ children }: { children: ReactNode }) {
  const mx = useMatrixClient();
  const space = useSpace();
  const [developerTools] = useSetting(settingsAtom, 'developerTools');
  const [roomToParents, setRoomToParents] = useAtom(roomToParentsAtom);
  const mDirects = useAtomValue(mDirectAtom);
  const allRooms = useAtomValue(allRoomsAtom);

  const { roomIdOrAlias, eventId } = useParams();
  const viaServers = useSearchParamsViaServers();
  const roomId = useSelectedRoom();
  const room = mx.getRoom(roomId);

  const isJoinedRoom = !!room && allRooms.includes(room.roomId);
  const willRenderRealProvider =
    isJoinedRoom &&
    !!room &&
    ((developerTools && room.isSpaceRoom() && room.roomId === space.roomId) ||
      getAllParents(roomToParents, room.roomId).has(space.roomId));
  useReadinessGate('route', !roomIdOrAlias || willRenderRealProvider, ROUTE_GATE_DEADLINE_MS);

  if (!roomIdOrAlias) return null;

  if (!isJoinedRoom) {
    return (
      <JoinBeforeNavigate roomIdOrAlias={roomIdOrAlias} eventId={eventId} viaServers={viaServers} />
    );
  }

  if (developerTools && room.isSpaceRoom() && room.roomId === space.roomId) {
    // allow to view space timeline
    return (
      <RoomProvider key={room.roomId} value={room}>
        <IsDirectRoomProvider value={mDirects.has(room.roomId)}>{children}</IsDirectRoomProvider>
      </RoomProvider>
    );
  }

  if (!getAllParents(roomToParents, room.roomId).has(space.roomId)) {
    if (getSpaceChildren(space).includes(room.roomId)) {
      // fill missing roomToParent mapping
      setRoomToParents({
        type: 'PUT',
        parent: space.roomId,
        children: [room.roomId],
      });
    }

    return (
      <JoinBeforeNavigate roomIdOrAlias={roomIdOrAlias} eventId={eventId} viaServers={viaServers} />
    );
  }

  return (
    <RoomProvider key={room.roomId} value={room}>
      <IsDirectRoomProvider value={mDirects.has(room.roomId)}>{children}</IsDirectRoomProvider>
    </RoomProvider>
  );
}
