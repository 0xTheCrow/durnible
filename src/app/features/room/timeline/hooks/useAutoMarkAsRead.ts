import { useCallback, useEffect, useState } from 'react';
import type { MatrixClient, Room } from 'matrix-js-sdk';
import { useDocumentFocusChange } from '../../../../hooks/useDocumentFocusChange';
import { useRoomUnread } from '../../../../state/hooks/unread';
import { roomToUnreadAtom } from '../../../../state/room/roomToUnread';
import { markAsRead } from '../../../../utils/notifications';
import { getReadReceiptEventId } from '../../../../utils/room/receipts';
import { useLiveEventArrive } from '../timelineState';

type UseAutoMarkAsReadParams = {
  mx: MatrixClient;
  room: Room;
  hideActivity: boolean;
  atBottom: boolean;
  isInLivePaginationWindow: boolean;
  onMarkAsRead?: () => void;
};

type UseAutoMarkAsReadResult = {
  readReceiptEventId: string | undefined;
  roomIsUnread: boolean;
};

export const useAutoMarkAsRead = ({
  mx,
  room,
  hideActivity,
  atBottom,
  isInLivePaginationWindow,
  onMarkAsRead,
}: UseAutoMarkAsReadParams): UseAutoMarkAsReadResult => {
  const [docFocused, setDocFocused] = useState(() =>
    typeof document !== 'undefined' ? document.hasFocus() : true
  );
  useDocumentFocusChange(useCallback((focused: boolean) => setDocFocused(focused), []));

  const roomUnread = useRoomUnread(room.roomId, roomToUnreadAtom);

  const markRoomAsRead = useCallback(() => {
    markAsRead(mx, room.roomId, hideActivity);
    onMarkAsRead?.();
  }, [mx, room.roomId, hideActivity, onMarkAsRead]);

  useEffect(() => {
    if (!docFocused) return;
    if (!atBottom) return;
    if (!isInLivePaginationWindow) return;
    markRoomAsRead();
  }, [docFocused, atBottom, isInLivePaginationWindow, markRoomAsRead]);

  useLiveEventArrive(
    room,
    useCallback(() => {
      if (!atBottom) return;
      if (!isInLivePaginationWindow) return;
      if (typeof document !== 'undefined' && !document.hasFocus()) return;
      markRoomAsRead();
    }, [atBottom, isInLivePaginationWindow, markRoomAsRead])
  );

  const readReceiptEventId = getReadReceiptEventId(room, mx.getSafeUserId());

  return {
    readReceiptEventId,
    roomIsUnread: !!roomUnread,
  };
};
