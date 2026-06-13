import type { MutableRefObject } from 'react';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { MatrixClient, Room } from 'matrix-js-sdk';
import { Direction } from 'matrix-js-sdk';
import { markAsRead } from '../../../utils/notifications';
import { getEventTimeline, getFirstLinkedTimeline } from './timelineUtils';

export type UnreadInfo = {
  readUptoEventId: string;
  inLiveTimeline: boolean;
  scrollTo: boolean;
};

export const getRoomUnreadInfo = (room: Room, scrollTo = false): UnreadInfo | undefined => {
  const readUptoEventId = room.getEventReadUpTo(room.client.getUserId() ?? '');
  if (!readUptoEventId) return undefined;
  const evtTimeline = getEventTimeline(room, readUptoEventId);
  const latestTimeline = evtTimeline && getFirstLinkedTimeline(evtTimeline, Direction.Forward);
  return {
    readUptoEventId,
    inLiveTimeline: latestTimeline === room.getLiveTimeline(),
    scrollTo,
  };
};

export type TimelineReadMarkerApi = {
  unreadInfo: UnreadInfo | undefined;
  setUnreadInfo: (info: UnreadInfo | undefined) => void;
  readUptoEventIdRef: MutableRefObject<string | undefined>;
  willScrollToReadMarker: boolean;
  tryAutoMarkAsRead: () => void;
  dividerReadUptoEventId: string | undefined;
  clearDivider: () => void;
};

export const useTimelineReadMarker = (
  mx: MatrixClient,
  room: Room,
  hideActivity: boolean,
  roomIsUnread: boolean
): TimelineReadMarkerApi => {
  const [unreadInfo, setUnreadInfo] = useState(() => getRoomUnreadInfo(room, true));
  const readUptoEventIdRef = useRef<string>();
  readUptoEventIdRef.current = unreadInfo?.readUptoEventId;

  const [dividerReadUptoEventId, setDividerReadUptoEventId] = useState<string | undefined>(
    () => unreadInfo?.readUptoEventId
  );
  useEffect(() => {
    if (dividerReadUptoEventId !== undefined) return;
    if (unreadInfo?.readUptoEventId) {
      setDividerReadUptoEventId(unreadInfo.readUptoEventId);
    }
  }, [unreadInfo?.readUptoEventId, dividerReadUptoEventId]);
  const clearDivider = useCallback(() => setDividerReadUptoEventId(undefined), []);

  const willScrollToReadMarker = !!(unreadInfo?.inLiveTimeline && unreadInfo?.scrollTo);

  const tryAutoMarkAsRead = useCallback(() => {
    const readUptoEventId = readUptoEventIdRef.current;
    if (!readUptoEventId) {
      markAsRead(mx, room.roomId, hideActivity);
      return;
    }
    const evtTimeline = getEventTimeline(room, readUptoEventId);
    const latestTimeline = evtTimeline && getFirstLinkedTimeline(evtTimeline, Direction.Forward);
    if (latestTimeline === room.getLiveTimeline()) {
      markAsRead(mx, room.roomId, hideActivity);
    }
  }, [mx, room, hideActivity]);

  useEffect(() => {
    if (!roomIsUnread) {
      setUnreadInfo(undefined);
    }
  }, [roomIsUnread]);

  return {
    unreadInfo,
    setUnreadInfo,
    readUptoEventIdRef,
    willScrollToReadMarker,
    tryAutoMarkAsRead,
    dividerReadUptoEventId,
    clearDivider,
  };
};
