import produce from 'immer';
import { atom, useSetAtom } from 'jotai';
import type { MatrixClient, MatrixEvent, Room } from 'matrix-js-sdk';
import { ClientEvent, RoomEvent, RoomStateEvent } from 'matrix-js-sdk';
import { useEffect } from 'react';
import type { ImagePack } from '../plugins/custom-emoji';
import { getRoomImagePack, getRoomImagePacks } from '../plugins/custom-emoji';
import { Membership, StateEvent } from '../../types/matrix/room';

export type PortableImagePacksMap = Map<string, ImagePack>;

const packKey = (roomId: string, stateKey: string): string => `${roomId}:${stateKey}`;

const collectPortableFromRoom = (room: Room, target: PortableImagePacksMap) => {
  const packs = getRoomImagePacks(room);
  packs.forEach((pack) => {
    if (!pack.address) return;
    if (!pack.meta.portable) return;
    target.set(packKey(pack.address.roomId, pack.address.stateKey), pack);
  });
};

const collectAllPortable = (mx: MatrixClient): PortableImagePacksMap => {
  const map: PortableImagePacksMap = new Map();
  mx.getRooms().forEach((room) => {
    if (room.getMyMembership() !== Membership.Join) return;
    collectPortableFromRoom(room, map);
  });
  return map;
};

const purgeRoom = (map: PortableImagePacksMap, roomId: string): PortableImagePacksMap => {
  const prefix = `${roomId}:`;
  let changed = false;
  const next = new Map(map);
  next.forEach((_pack, key) => {
    if (key.startsWith(prefix)) {
      next.delete(key);
      changed = true;
    }
  });
  return changed ? next : map;
};

export type PortableImagePacksAction =
  | { type: 'INITIALIZE'; map: PortableImagePacksMap }
  | { type: 'UPSERT'; roomId: string; stateKey: string; pack: ImagePack | undefined }
  | { type: 'PURGE_ROOM'; roomId: string }
  | { type: 'RESCAN_ROOM'; room: Room };

const basePortableImagePacksAtom = atom<PortableImagePacksMap>(new Map());
export const portableImagePacksAtom = atom<
  PortableImagePacksMap,
  [PortableImagePacksAction],
  undefined
>(
  (get) => get(basePortableImagePacksAtom),
  (get, set, action) => {
    if (action.type === 'INITIALIZE') {
      set(basePortableImagePacksAtom, action.map);
      return;
    }
    if (action.type === 'UPSERT') {
      const current = get(basePortableImagePacksAtom);
      const key = packKey(action.roomId, action.stateKey);
      const existing = current.get(key);
      const nextPack = action.pack && action.pack.meta.portable ? action.pack : undefined;
      if (!existing && !nextPack) return;
      if (existing && nextPack && existing === nextPack) return;
      set(
        basePortableImagePacksAtom,
        produce(current, (draft) => {
          if (nextPack) {
            draft.set(key, nextPack);
          } else {
            draft.delete(key);
          }
        })
      );
      return;
    }
    if (action.type === 'PURGE_ROOM') {
      const current = get(basePortableImagePacksAtom);
      const next = purgeRoom(current, action.roomId);
      if (next !== current) set(basePortableImagePacksAtom, next);
      return;
    }
    if (action.type === 'RESCAN_ROOM') {
      const current = get(basePortableImagePacksAtom);
      const cleaned = purgeRoom(current, action.room.roomId);
      const next = new Map(cleaned);
      collectPortableFromRoom(action.room, next);
      if (next.size === current.size) {
        let same = true;
        next.forEach((pack, key) => {
          if (current.get(key) !== pack) same = false;
        });
        if (same) return;
      }
      set(basePortableImagePacksAtom, next);
    }
  }
);

export const useBindPortableImagePacksAtom = (
  mx: MatrixClient,
  packsAtom: typeof portableImagePacksAtom
) => {
  const setPortablePacks = useSetAtom(packsAtom);

  useEffect(() => {
    setPortablePacks({ type: 'INITIALIZE', map: collectAllPortable(mx) });

    const handleStateChange = (mEvent: MatrixEvent) => {
      if (mEvent.getType() !== StateEvent.PoniesRoomEmotes) return;
      const roomId = mEvent.getRoomId();
      const stateKey = mEvent.getStateKey();
      if (!roomId || typeof stateKey !== 'string') return;
      const room = mx.getRoom(roomId);
      if (!room || room.getMyMembership() !== Membership.Join) {
        setPortablePacks({ type: 'UPSERT', roomId, stateKey, pack: undefined });
        return;
      }
      const pack = getRoomImagePack(room, stateKey);
      setPortablePacks({ type: 'UPSERT', roomId, stateKey, pack });
    };

    const handleAddRoom = (room: Room) => {
      if (room.getMyMembership() !== Membership.Join) return;
      setPortablePacks({ type: 'RESCAN_ROOM', room });
    };

    const handleMembershipChange = (room: Room) => {
      if (room.getMyMembership() === Membership.Join) {
        setPortablePacks({ type: 'RESCAN_ROOM', room });
        return;
      }
      setPortablePacks({ type: 'PURGE_ROOM', roomId: room.roomId });
    };

    const handleDeleteRoom = (roomId: string) => {
      setPortablePacks({ type: 'PURGE_ROOM', roomId });
    };

    mx.on(RoomStateEvent.Events, handleStateChange);
    mx.on(ClientEvent.Room, handleAddRoom);
    mx.on(RoomEvent.MyMembership, handleMembershipChange);
    mx.on(ClientEvent.DeleteRoom, handleDeleteRoom);
    return () => {
      mx.removeListener(RoomStateEvent.Events, handleStateChange);
      mx.removeListener(ClientEvent.Room, handleAddRoom);
      mx.removeListener(RoomEvent.MyMembership, handleMembershipChange);
      mx.removeListener(ClientEvent.DeleteRoom, handleDeleteRoom);
    };
  }, [mx, setPortablePacks]);
};
