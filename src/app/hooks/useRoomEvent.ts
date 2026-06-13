import type { IEvent, Room } from 'matrix-js-sdk';
import { MatrixEvent, MatrixEventEvent } from 'matrix-js-sdk';
import { useCallback, useMemo, useSyncExternalStore } from 'react';
import to from 'await-to-js';
import type { CryptoBackend } from 'matrix-js-sdk/lib/common-crypto/CryptoBackend';
import { useQuery } from '@tanstack/react-query';
import { useMatrixClient } from './useMatrixClient';

const useFetchEvent = (room: Room, eventId: string) => {
  const mx = useMatrixClient();

  const fetchEventCallback = useCallback(async () => {
    const evt = await mx.fetchRoomEvent(room.roomId, eventId);
    const mEvent = new MatrixEvent(evt);

    if (evt.unsigned?.['m.relations'] && evt.unsigned?.['m.relations']['m.replace']) {
      const replaceEvt = evt.unsigned?.['m.relations']['m.replace'] as IEvent;
      const replaceEvent = new MatrixEvent(replaceEvt);
      if (replaceEvent.isEncrypted() && mx.getCrypto()) {
        await to(replaceEvent.attemptDecryption(mx.getCrypto() as CryptoBackend));
      }
      mEvent.makeReplaced(replaceEvent);
    }

    if (mEvent.isEncrypted() && mx.getCrypto()) {
      await to(mEvent.attemptDecryption(mx.getCrypto() as CryptoBackend));
    }

    return mEvent;
  }, [mx, room.roomId, eventId]);

  return fetchEventCallback;
};

/**
 *
 * @param room
 * @param eventId
 * @returns `MatrixEvent`, `undefined` means loading, `null` means failure
 */
export const useRoomEvent = (
  room: Room,
  eventId: string,
  getLocally?: () => MatrixEvent | undefined
) => {
  const event = useMemo(() => {
    if (getLocally) return getLocally();
    return room.findEventById(eventId);
  }, [room, eventId, getLocally]);

  const fetchEvent = useFetchEvent(room, eventId);

  const { data, error, isFetching } = useQuery({
    enabled: event === undefined && Boolean(eventId),
    queryKey: [room.roomId, eventId],
    queryFn: fetchEvent,
    staleTime: Infinity,
    gcTime: 60 * 60 * 1000,
  });

  const fallback = useMemo(
    () => (error && !isFetching ? room.findEventById(eventId) ?? null : undefined),
    [error, isFetching, room, eventId]
  );

  const result = event ?? data ?? (fallback !== undefined ? fallback : undefined);

  const subscribe = useCallback(
    (onChange: () => void) => {
      if (!result) return () => undefined;
      result.on(MatrixEventEvent.Replaced, onChange);
      result.on(MatrixEventEvent.Decrypted, onChange);
      const replacing = result.replacingEvent();
      if (replacing) {
        replacing.on(MatrixEventEvent.Decrypted, onChange);
      }
      return () => {
        result.removeListener(MatrixEventEvent.Replaced, onChange);
        result.removeListener(MatrixEventEvent.Decrypted, onChange);
        if (replacing) {
          replacing.removeListener(MatrixEventEvent.Decrypted, onChange);
        }
      };
    },
    [result]
  );

  const getSnapshot = useCallback(() => {
    if (!result) return 'none';
    const content = result.getContent() as { body?: unknown; msgtype?: unknown };
    const bodyKey = typeof content.body === 'string' ? content.body : '';
    const msgtypeKey = typeof content.msgtype === 'string' ? content.msgtype : '';
    const replacingId = result.replacingEvent()?.getId() ?? '';
    return `${bodyKey}|${msgtypeKey}|${result.isRedacted()}|${replacingId}`;
  }, [result]);

  useSyncExternalStore(subscribe, getSnapshot, getSnapshot);

  return result;
};
