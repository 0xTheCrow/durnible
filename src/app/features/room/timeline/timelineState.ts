import type { Dispatch, SetStateAction } from 'react';
import { useEffect, useMemo, useRef } from 'react';
import type {
  EventTimeline,
  EventTimelineSetHandlerMap,
  MatrixClient,
  MatrixEvent,
  Room,
  RoomEventHandlerMap,
} from 'matrix-js-sdk';
import { Direction, MatrixEventEvent, RoomEvent } from 'matrix-js-sdk';
import to from 'await-to-js';
import { MessageEvent } from '../../../../types/matrix/room';
import { useAlive } from '../../../hooks/useAlive';
import { decryptAllTimelineEvent, decryptEvents } from '../../../utils/room';
import {
  getEventIdAbsoluteIndex,
  getLinkedTimelines,
  getLiveTimeline,
  getTimelinesEventsCount,
} from './timelineUtils';
import { createTimelineWindow } from './utils/timelineWindow';

export const PAGINATION_LIMIT = 80;

export type TimelineRange = {
  oldest: number;
  newest: number;
};

export type TimelineWindow = {
  startEventId: string | undefined;
  size: number;
};

export type Timeline = {
  linkedTimelines: EventTimeline[];
  window: TimelineWindow;
};

export const getInitialTimeline = (room: Room): Timeline => {
  const linkedTimelines = getLinkedTimelines(getLiveTimeline(room));
  const evLength = getTimelinesEventsCount(linkedTimelines);
  return {
    linkedTimelines,
    window: createTimelineWindow(
      linkedTimelines,
      Math.max(evLength - PAGINATION_LIMIT, 0),
      evLength
    ),
  };
};

// Surrounding context is loaded and decrypted up front so callers can render
// the new range and scroll to the target without later height shifts from
// late-arriving content.
export const loadEventContext = async (
  mx: MatrixClient,
  room: Room,
  eventId: string,
  contextSize: number
): Promise<{ linkedTimelines: EventTimeline[]; absoluteIndex: number } | null> => {
  const [, eventTimeline] = await to(mx.getEventTimeline(room.getUnfilteredTimelineSet(), eventId));
  if (!eventTimeline) return null;

  let linkedTimelines = getLinkedTimelines(eventTimeline);
  let absoluteIndex = getEventIdAbsoluteIndex(linkedTimelines, eventTimeline, eventId);
  if (absoluteIndex === undefined) return null;

  while (absoluteIndex < contextSize) {
    const oldestTimeline = linkedTimelines[0];
    const token = oldestTimeline.getPaginationToken(Direction.Backward);
    if (!token) break;
    const [paginateError] = await to(
      mx.paginateEventTimeline(oldestTimeline, { backwards: true, limit: contextSize })
    );
    if (paginateError) break;
    linkedTimelines = getLinkedTimelines(eventTimeline);
    const recomputed = getEventIdAbsoluteIndex(linkedTimelines, eventTimeline, eventId);
    if (recomputed === undefined) return null;
    absoluteIndex = recomputed;
  }

  let totalCount = getTimelinesEventsCount(linkedTimelines);
  while (totalCount - absoluteIndex - 1 < contextSize) {
    const newestTimeline = linkedTimelines[linkedTimelines.length - 1];
    const token = newestTimeline.getPaginationToken(Direction.Forward);
    if (!token) break;
    const [paginateError] = await to(
      mx.paginateEventTimeline(newestTimeline, { backwards: false, limit: contextSize })
    );
    if (paginateError) break;
    linkedTimelines = getLinkedTimelines(eventTimeline);
    totalCount = getTimelinesEventsCount(linkedTimelines);
  }

  if (room.hasEncryptionStateEvent()) {
    const oldestEventIndex = Math.max(absoluteIndex - contextSize, 0);
    const newestEventIndex = Math.min(absoluteIndex + contextSize, totalCount);
    const eventsToDecrypt: MatrixEvent[] = [];
    let timelineStartIndex = 0;
    for (const timeline of linkedTimelines) {
      const events = timeline.getEvents();
      const timelineEndIndex = timelineStartIndex + events.length;
      if (timelineEndIndex <= oldestEventIndex) {
        timelineStartIndex = timelineEndIndex;
        continue;
      }
      if (timelineStartIndex >= newestEventIndex) break;
      const sliceStart = Math.max(0, oldestEventIndex - timelineStartIndex);
      const sliceEnd = Math.min(events.length, newestEventIndex - timelineStartIndex);
      for (let i = sliceStart; i < sliceEnd; i += 1) {
        eventsToDecrypt.push(events[i]);
      }
      timelineStartIndex = timelineEndIndex;
    }
    await decryptEvents(mx, eventsToDecrypt);
  }

  return { linkedTimelines, absoluteIndex };
};

export const useTimelinePagination = (
  mx: MatrixClient,
  timeline: Timeline,
  setTimeline: Dispatch<SetStateAction<Timeline>>,
  limit: number,
  onFetchStateChange?: (backwards: boolean, fetching: boolean) => void
) => {
  const timelineRef = useRef(timeline);
  timelineRef.current = timeline;
  const onFetchStateChangeRef = useRef(onFetchStateChange);
  onFetchStateChangeRef.current = onFetchStateChange;
  const alive = useAlive();

  const handleTimelinePagination = useMemo(() => {
    let fetching = false;

    const recalibratePagination = (linkedTimelines: EventTimeline[]) => {
      setTimeline((currentTimeline) => ({
        ...currentTimeline,
        linkedTimelines: getLinkedTimelines(linkedTimelines[0]),
      }));
    };

    return async (backwards: boolean) => {
      if (fetching) return;
      const { linkedTimelines: lTimelines } = timelineRef.current;

      const timelineToPaginate = backwards ? lTimelines[0] : lTimelines[lTimelines.length - 1];
      if (!timelineToPaginate) return;

      const paginationToken = timelineToPaginate.getPaginationToken(
        backwards ? Direction.Backward : Direction.Forward
      );
      if (
        !paginationToken &&
        getTimelinesEventsCount(lTimelines) !==
          getTimelinesEventsCount(getLinkedTimelines(timelineToPaginate))
      ) {
        recalibratePagination(lTimelines);
        return;
      }
      if (!paginationToken) return;

      fetching = true;
      onFetchStateChangeRef.current?.(backwards, true);
      const [err] = await to(
        mx.paginateEventTimeline(timelineToPaginate, {
          backwards,
          limit,
        })
      );
      if (err) {
        fetching = false;
        onFetchStateChangeRef.current?.(backwards, false);
        return;
      }
      const fetchedTimeline =
        timelineToPaginate.getNeighbouringTimeline(
          backwards ? Direction.Backward : Direction.Forward
        ) ?? timelineToPaginate;
      const roomId = fetchedTimeline.getRoomId();
      const room = roomId ? mx.getRoom(roomId) : null;

      if (room?.hasEncryptionStateEvent()) {
        await to(decryptAllTimelineEvent(mx, fetchedTimeline));
      }

      fetching = false;
      onFetchStateChangeRef.current?.(backwards, false);
      if (alive()) {
        recalibratePagination(lTimelines);
      }
    };
  }, [mx, alive, setTimeline, limit]);
  return handleTimelinePagination;
};

export const useLiveEventArrive = (room: Room, onArrive: (mEvent: MatrixEvent) => void) => {
  useEffect(() => {
    const handleTimelineEvent: EventTimelineSetHandlerMap[RoomEvent.Timeline] = (
      mEvent,
      eventRoom,
      toStartOfTimeline,
      removed,
      data
    ) => {
      if (eventRoom?.roomId !== room.roomId || !data.liveEvent) return;
      onArrive(mEvent);
    };
    const handleRedaction: RoomEventHandlerMap[RoomEvent.Redaction] = (mEvent, eventRoom) => {
      if (eventRoom?.roomId !== room.roomId) return;
      onArrive(mEvent);
    };

    room.on(RoomEvent.Timeline, handleTimelineEvent);
    room.on(RoomEvent.Redaction, handleRedaction);
    return () => {
      room.removeListener(RoomEvent.Timeline, handleTimelineEvent);
      room.removeListener(RoomEvent.Redaction, handleRedaction);
    };
  }, [room, onArrive]);
};

export const useLiveTimelineReset = (room: Room, onReset: () => void) => {
  useEffect(() => {
    const handleTimelineReset: EventTimelineSetHandlerMap[RoomEvent.TimelineReset] = (
      eventRoom
    ) => {
      if (eventRoom?.roomId !== room.roomId) return;
      onReset();
    };

    room.on(RoomEvent.TimelineReset, handleTimelineReset);
    return () => {
      room.removeListener(RoomEvent.TimelineReset, handleTimelineReset);
    };
  }, [room, onReset]);
};

export const useLiveTimelineRefresh = (room: Room, onRefresh: () => void) => {
  useEffect(() => {
    const handleTimelineRefresh: RoomEventHandlerMap[RoomEvent.TimelineRefresh] = (r) => {
      if (r.roomId !== room.roomId) return;
      onRefresh();
    };

    room.on(RoomEvent.TimelineRefresh, handleTimelineRefresh);
    return () => {
      room.removeListener(RoomEvent.TimelineRefresh, handleTimelineRefresh);
    };
  }, [room, onRefresh]);
};

export const useLiveEventDecryption = (room: Room, onDecrypted: (mEvent: MatrixEvent) => void) => {
  useEffect(() => {
    const pending = new Map<MatrixEvent, () => void>();
    const handleTimelineEvent: EventTimelineSetHandlerMap[RoomEvent.Timeline] = (
      mEvent,
      eventRoom,
      _toStartOfTimeline,
      _removed,
      data
    ) => {
      if (eventRoom?.roomId !== room.roomId || !data.liveEvent) return;
      if (mEvent.getType() !== MessageEvent.RoomMessageEncrypted) return;
      const handleDecrypted = () => {
        if (mEvent.getType() === MessageEvent.RoomMessageEncrypted) return;
        mEvent.removeListener(MatrixEventEvent.Decrypted, handleDecrypted);
        pending.delete(mEvent);
        onDecrypted(mEvent);
      };
      pending.set(mEvent, handleDecrypted);
      mEvent.on(MatrixEventEvent.Decrypted, handleDecrypted);
    };

    room.on(RoomEvent.Timeline, handleTimelineEvent);
    return () => {
      room.removeListener(RoomEvent.Timeline, handleTimelineEvent);
      pending.forEach((handler, evt) => evt.removeListener(MatrixEventEvent.Decrypted, handler));
      pending.clear();
    };
  }, [room, onDecrypted]);
};
