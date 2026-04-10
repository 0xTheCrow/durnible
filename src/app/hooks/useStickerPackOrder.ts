import { useState, useCallback } from 'react';
import { useMatrixClient } from './useMatrixClient';
import { useAccountDataCallback } from './useAccountDataCallback';
import { AccountDataEvent } from '../../types/matrix/accountData';
import { getAccountData } from '../utils/room';

export type StickerPackOrderContent = {
  order: string[];
};

export function useStickerPackOrder(): [string[], (ids: string[]) => void] {
  const mx = useMatrixClient();

  const [orderedIds, setOrderedIds] = useState<string[]>(() => {
    const content = getAccountData(
      mx,
      AccountDataEvent.CinnyStickerPackOrder
    )?.getContent<StickerPackOrderContent>();
    return content?.order ?? [];
  });

  useAccountDataCallback(
    mx,
    useCallback((evt) => {
      if (evt.getType() === AccountDataEvent.CinnyStickerPackOrder) {
        const content = evt.getContent<StickerPackOrderContent>();
        setOrderedIds(content?.order ?? []);
      }
    }, [])
  );

  const setOrder = useCallback(
    (ids: string[]) => {
      setOrderedIds(ids);
      mx.setAccountData(AccountDataEvent.CinnyStickerPackOrder, { order: ids });
    },
    [mx]
  );

  return [orderedIds, setOrder];
}
