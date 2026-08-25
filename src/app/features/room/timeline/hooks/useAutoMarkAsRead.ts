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
  isLatestMessageBottomVisible: boolean;
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
  isLatestMessageBottomVisible,
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
    if (!isLatestMessageBottomVisible) return;
    markRoomAsRead();
  }, [docFocused, isLatestMessageBottomVisible, markRoomAsRead]);

  useLiveEventArrive(
    room,
    useCallback(() => {
      if (!isLatestMessageBottomVisible) return;
      if (typeof document !== 'undefined' && !document.hasFocus()) return;
      markRoomAsRead();
    }, [isLatestMessageBottomVisible, markRoomAsRead])
  );

  const readReceiptEventId = getReadReceiptEventId(room, mx.getSafeUserId());

  return {
    readReceiptEventId,
    roomIsUnread: !!roomUnread,
  };
};
