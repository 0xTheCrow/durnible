import { useMemo } from 'react';
import type { Room } from 'matrix-js-sdk';
import type { ImagePack } from '../plugins/custom-emoji';
import { useGlobalImagePacks, useRoomsImagePacks, useUserImagePack } from './useImagePacks';

export const useImagePackMimetypes = (imagePackRooms: Room[]): Map<string, string> => {
  const userPack = useUserImagePack();
  const globalPacks = useGlobalImagePacks();
  const roomsPacks = useRoomsImagePacks(imagePackRooms);

  return useMemo(() => {
    const map = new Map<string, string>();
    const addFromPack = (pack: ImagePack) => {
      pack.images.collection.forEach((image) => {
        const mime = image.info?.mimetype;
        if (typeof mime === 'string' && !map.has(image.url)) {
          map.set(image.url, mime);
        }
      });
    };
    if (userPack) addFromPack(userPack);
    globalPacks.forEach(addFromPack);
    roomsPacks.forEach(addFromPack);
    return map;
  }, [userPack, globalPacks, roomsPacks]);
};
