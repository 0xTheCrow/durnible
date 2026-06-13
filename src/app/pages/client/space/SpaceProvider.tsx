import type { ReactNode } from 'react';
import React from 'react';
import { useParams } from 'react-router-dom';
import { useMatrixClient } from '../../../hooks/useMatrixClient';
import { useSpaces } from '../../../state/hooks/roomList';
import { allRoomsAtom } from '../../../state/room-list/roomList';
import { useSelectedSpace } from '../../../hooks/router/useSelectedSpace';
import { SpaceProvider } from '../../../hooks/useSpace';
import { JoinBeforeNavigate } from '../../../features/join-before-navigate';
import { useSearchParamsViaServers } from '../../../hooks/router/useSearchParamsViaServers';
import { ROUTE_GATE_DEADLINE_MS, useReadinessGate } from '../../../state/readiness';

type RouteSpaceProviderProps = {
  children: ReactNode;
};
export function RouteSpaceProvider({ children }: RouteSpaceProviderProps) {
  const mx = useMatrixClient();
  const joinedSpaces = useSpaces(mx, allRoomsAtom);

  const { spaceIdOrAlias } = useParams();
  const viaServers = useSearchParamsViaServers();

  const selectedSpaceId = useSelectedSpace();
  const space = mx.getRoom(selectedSpaceId);

  const isJoinedSpace = !!space && joinedSpaces.includes(space.roomId);
  useReadinessGate('route', isJoinedSpace, ROUTE_GATE_DEADLINE_MS);

  if (!isJoinedSpace) {
    return <JoinBeforeNavigate roomIdOrAlias={spaceIdOrAlias ?? ''} viaServers={viaServers} />;
  }

  return (
    <SpaceProvider key={space.roomId} value={space}>
      {children}
    </SpaceProvider>
  );
}
