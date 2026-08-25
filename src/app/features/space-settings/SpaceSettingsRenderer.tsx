import React, { lazy, Suspense } from 'react';
import { Modal500 } from '../../components/Modal500';
import { useCloseSpaceSettings, useSpaceSettingsState } from '../../state/hooks/spaceSettings';
import { useAllJoinedRoomsSet, useGetRoom } from '../../hooks/useGetRoom';
import type { SpaceSettingsState } from '../../state/spaceSettings';
import { RoomProvider } from '../../hooks/useRoom';
import { SpaceProvider } from '../../hooks/useSpace';

const LazySpaceSettings = lazy(() =>
  import('./SpaceSettings').then((module) => ({ default: module.SpaceSettings }))
);

type RenderSettingsProps = {
  state: SpaceSettingsState;
};
function RenderSettings({ state }: RenderSettingsProps) {
  const { roomId, spaceId, page } = state;
  const closeSettings = useCloseSpaceSettings();
  const allJoinedRooms = useAllJoinedRoomsSet();
  const getRoom = useGetRoom(allJoinedRooms);
  const room = getRoom(roomId);
  const space = spaceId && spaceId !== roomId ? getRoom(spaceId) : undefined;

  if (!room) return null;

  return (
    <Suspense fallback={null}>
      <Modal500 onClose={closeSettings}>
        <SpaceProvider value={space ?? null}>
          <RoomProvider value={room}>
            <LazySpaceSettings initialPage={page} onClose={closeSettings} />
          </RoomProvider>
        </SpaceProvider>
      </Modal500>
    </Suspense>
  );
}

export function SpaceSettingsRenderer() {
  const state = useSpaceSettingsState();

  if (!state) return null;
  return <RenderSettings state={state} />;
}
