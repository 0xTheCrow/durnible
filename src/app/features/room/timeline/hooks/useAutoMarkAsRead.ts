import type { RefObject } from 'react';
import { useCallback, useEffect, useState } from 'react';
import type { MatrixClient, Room } from 'matrix-js-sdk';
import { Direction } from 'matrix-js-sdk';
import { useDocumentFocusChange } from '../../../../hooks/useDocumentFocusChange';
import { useRoomUnread } from '../../../../state/hooks/unread';
import { roomToUnreadAtom } from '../../../../state/room/roomToUnread';
import { markAsRead } from '../../../../utils/notifications';
import { getReadReceiptEventId } from '../../../../utils/room/receipts';
import { useLiveEventArrive } from '../timelineState';
import { getEventTimeline, getFirstLinkedTimeline } from '../timelineUtils';

type UseAutoMarkAsReadParams = {
  mx: MatrixClient;
  room: Room;
  hideActivity: boolean;
  atBottom: boolean;
  atBottomRef: RefObject<boolean>;
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
  atBottomRef,
  onMarkAsRead,
}: UseAutoMarkAsReadParams): UseAutoMarkAsReadResult => {
  const [docFocused, setDocFocused] = useState(() =>
    typeof document !== 'undefined' ? document.hasFocus() : true
  );
  useDocumentFocusChange(useCallback((focused: boolean) => setDocFocused(focused), []));

  const roomUnread = useRoomUnread(room.roomId, roomToUnreadAtom);

  const tryAutoMarkAsRead = useCallback(() => {
    const readReceiptEventId = room.getEventReadUpTo(room.client.getUserId() ?? '');
    const markRead = () => {
      markAsRead(mx, room.roomId, hideActivity);
      onMarkAsRead?.();
    };
    if (!readReceiptEventId) {
      markRead();
      return;
    }
    const eventTimeline = getEventTimeline(room, readReceiptEventId);
    const latestTimeline =
      eventTimeline && getFirstLinkedTimeline(eventTimeline, Direction.Forward);
    if (latestTimeline === room.getLiveTimeline()) {
      markRead();
    }
  }, [mx, room, hideActivity, onMarkAsRead]);

  useEffect(() => {
    if (!docFocused) return;
    if (!atBottom) return;
    tryAutoMarkAsRead();
  }, [docFocused, atBottom, tryAutoMarkAsRead]);

  useLiveEventArrive(
    room,
    useCallback(() => {
      if (!atBottomRef.current) return;
      if (typeof document !== 'undefined' && !document.hasFocus()) return;
      tryAutoMarkAsRead();
    }, [atBottomRef, tryAutoMarkAsRead])
  );

  const readReceiptEventId = getReadReceiptEventId(room, mx.getSafeUserId());

  return {
    readReceiptEventId,
    roomIsUnread: !!roomUnread,
  };
};
