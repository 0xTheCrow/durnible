import { useEffect, useState } from 'react';
import type { MatrixClient, Room } from 'matrix-js-sdk';
import { RoomEvent } from 'matrix-js-sdk';

const FAVORITE_TAG = 'm.favourite';

const getFavoriteRooms = (mx: MatrixClient): Room[] =>
  mx
    .getRooms()
    .filter((room) => room.getMyMembership() === 'join' && FAVORITE_TAG in room.tags)
    .sort((a, b) => {
      const ao = a.tags[FAVORITE_TAG]?.order ?? 0.5;
      const bo = b.tags[FAVORITE_TAG]?.order ?? 0.5;
      return ao - bo;
    });

export const useFavoriteRooms = (mx: MatrixClient): Room[] => {
  const [rooms, setRooms] = useState(() => getFavoriteRooms(mx));

  useEffect(() => {
    const onTagsChange = () => setRooms(getFavoriteRooms(mx));
    mx.on(RoomEvent.Tags, onTagsChange);
    return () => {
      mx.off(RoomEvent.Tags, onTagsChange);
    };
  }, [mx]);

  return rooms;
};
