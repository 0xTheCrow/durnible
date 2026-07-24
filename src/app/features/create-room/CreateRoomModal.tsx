import React from 'react';
import { Box, config, Header, Icon, IconButton, Icons, Modal, Scroll, Text } from 'folds';
import { useAllJoinedRoomsSet, useGetRoom } from '../../hooks/useGetRoom';
import { SpaceProvider } from '../../hooks/useSpace';
import { CreateRoomForm } from './CreateRoom';
import {
  useCloseCreateRoomModal,
  useCreateRoomModalState,
} from '../../state/hooks/createRoomModal';
import type { CreateRoomModalState } from '../../state/createRoomModal';
import { OverlayModal } from '../../components/OverlayModal';
import { RoomType } from '../../../types/matrix/room';

type CreateRoomModalProps = {
  state: CreateRoomModalState;
};
function CreateRoomModal({ state }: CreateRoomModalProps) {
  const { spaceId, roomType } = state;
  const closeDialog = useCloseCreateRoomModal();
  const title = roomType === RoomType.Call ? 'New Voice Room' : 'New Room';

  const allJoinedRooms = useAllJoinedRoomsSet();
  const getRoom = useGetRoom(allJoinedRooms);
  const space = spaceId ? getRoom(spaceId) : undefined;

  return (
    <SpaceProvider value={space ?? null}>
      <OverlayModal open onClose={closeDialog}>
        <Modal size="300" flexHeight>
          <Box direction="Column">
            <Header
              size="500"
              style={{
                padding: config.space.S200,
                paddingLeft: config.space.S400,
              }}
            >
              <Box grow="Yes">
                <Text size="H4">{title}</Text>
              </Box>
              <Box shrink="No">
                <IconButton size="300" radii="300" onClick={closeDialog}>
                  <Icon src={Icons.Cross} />
                </IconButton>
              </Box>
            </Header>
            <Scroll size="300" hideTrack>
              <Box
                style={{
                  padding: config.space.S400,
                  paddingRight: config.space.S200,
                }}
                direction="Column"
                gap="500"
              >
                <CreateRoomForm space={space} roomType={roomType} onCreate={closeDialog} />
              </Box>
            </Scroll>
          </Box>
        </Modal>
      </OverlayModal>
    </SpaceProvider>
  );
}

export function CreateRoomModalRenderer() {
  const state = useCreateRoomModalState();

  if (!state) return null;
  return <CreateRoomModal state={state} />;
}
