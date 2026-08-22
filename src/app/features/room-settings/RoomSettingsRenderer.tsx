import React, { lazy, Suspense } from 'react';
import { Modal500 } from '../../components/Modal500';
import { useCloseRoomSettings, useRoomSettingsState } from '../../state/hooks/roomSettings';
import { useAllJoinedRoomsSet, useGetRoom } from '../../hooks/useGetRoom';
import type { RoomSettingsState } from '../../state/roomSettings';
import { RoomProvider } from '../../hooks/useRoom';
import { SpaceProvider } from '../../hooks/useSpace';

const LazyRoomSettings = lazy(() =>
  import('./RoomSettings').then((module) => ({ default: module.RoomSettings }))
);

type RenderSettingsProps = {
  state: RoomSettingsState;
};
function RenderSettings({ state }: RenderSettingsProps) {
  const { roomId, spaceId, page } = state;
  const closeSettings = useCloseRoomSettings();
  const allJoinedRooms = useAllJoinedRoomsSet();
  const getRoom = useGetRoom(allJoinedRooms);
  const room = getRoom(roomId);
  const space = spaceId ? getRoom(spaceId) : undefined;

  if (!room) return null;

  return (
    <Suspense fallback={null}>
      <Modal500 onClose={closeSettings}>
        <SpaceProvider value={space ?? null}>
          <RoomProvider value={room}>
            <LazyRoomSettings initialPage={page} onClose={closeSettings} />
          </RoomProvider>
        </SpaceProvider>
      </Modal500>
    </Suspense>
  );
}

export function RoomSettingsRenderer() {
  const state = useRoomSettingsState();

  if (!state) return null;
  return <RenderSettings state={state} />;
}
