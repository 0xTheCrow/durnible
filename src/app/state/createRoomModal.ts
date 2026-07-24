import { atom } from 'jotai';
import type { RoomType } from '../../types/matrix/room';

export type CreateRoomModalState = {
  spaceId?: string;
  roomType?: RoomType;
};

export const createRoomModalAtom = atom<CreateRoomModalState | undefined>(undefined);
