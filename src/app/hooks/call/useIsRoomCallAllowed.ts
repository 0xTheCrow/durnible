import { useAtomValue } from 'jotai';
import type { Room } from 'matrix-js-sdk';
import { mDirectAtom } from '../../state/mDirectList';
import { roomToParentsAtom } from '../../state/room/roomToParents';
import { checkIsRoomCallAllowed } from '../../utils/room';

export const useIsRoomCallAllowed = (room: Room): boolean => {
  const mDirects = useAtomValue(mDirectAtom);
  const roomToParents = useAtomValue(roomToParentsAtom);

  return checkIsRoomCallAllowed(room, mDirects, roomToParents);
};
