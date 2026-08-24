import type { Dispatch, SetStateAction, RefObject } from 'react';
import { useCallback, useEffect } from 'react';
import type { MatrixEvent, Room, RoomEventHandlerMap } from 'matrix-js-sdk';
import { RoomEvent } from 'matrix-js-sdk';
import { useLiveEventArrive, useLiveEventDecryption } from '../timelineState';
import type { Timeline } from '../timelineState';
import { getTimelinesEventsCount } from '../timelineUtils';
import { isModifierTimelineEvent } from '../../../../utils/room';
import { getScrollBottomDistance } from '../../../../utils/dom';
import { createTimelineWindow } from '../utils/timelineWindow';
import { traceTimelineScroll } from '../utils/scrollTrace';

type UseLiveTimelineUpdatesParams = {
  room: Room;
  setTimeline: Dispatch<SetStateAction<Timeline>>;
  scrollRef: RefObject<HTMLDivElement>;
  checkIsAtLiveEdge: () => boolean;
  pinToLiveEnd: () => void;
  unfocusedAutoScroll: boolean;
};

export const useLiveTimelineUpdates = ({
  room,
  setTimeline,
  scrollRef,
  checkIsAtLiveEdge,
  pinToLiveEnd,
  unfocusedAutoScroll,
}: UseLiveTimelineUpdatesParams): void => {
  const handleLiveEventArrive = useCallback(
    (mEvent: MatrixEvent) => {
      const isModifier = isModifierTimelineEvent(mEvent);

      if (isModifier) {
        setTimeline((current) => ({ ...current }));
        return;
      }

      const focused = typeof document !== 'undefined' && document.hasFocus();
      const autoPinEnabled = focused || unfocusedAutoScroll;
      const isAtLiveEdge = checkIsAtLiveEdge();
      const scrollElement = scrollRef.current;

      traceTimelineScroll('liveEventArrive', {
        eventId: mEvent.getId(),
        isAtLiveEdge,
        focused,
        autoPinEnabled,
        scrollBottomDistance: scrollElement
          ? Math.round(getScrollBottomDistance(scrollElement))
          : null,
      });

      if (isAtLiveEdge) {
        if (autoPinEnabled) pinToLiveEnd();
        setTimeline((current) => {
          const total = getTimelinesEventsCount(current.linkedTimelines);
          return {
            ...current,
            window: createTimelineWindow(
              current.linkedTimelines,
              Math.max(0, total - current.window.size),
              total
            ),
          };
        });
        return;
      }

      setTimeline((current) => ({ ...current }));
    },
    [setTimeline, scrollRef, checkIsAtLiveEdge, pinToLiveEnd, unfocusedAutoScroll]
  );

  useLiveEventArrive(room, handleLiveEventArrive);

  const handleDecrypted = useCallback(() => {
    setTimeline((current) => ({ ...current }));
  }, [setTimeline]);

  useLiveEventDecryption(room, handleDecrypted);

  // Re-render when a local echo status changes (QUEUED → SENDING → sent / NOT_SENT).
  // RoomEvent.Timeline only fires for new events, so echoes updating in-place are missed.
  useEffect(() => {
    const handleLocalEchoUpdated: RoomEventHandlerMap[RoomEvent.LocalEchoUpdated] = (
      _mEvent,
      eventRoom
    ) => {
      if (eventRoom?.roomId !== room.roomId) return;
      setTimeline((current) => ({ ...current }));
    };
    room.on(RoomEvent.LocalEchoUpdated, handleLocalEchoUpdated);
    return () => {
      room.off(RoomEvent.LocalEchoUpdated, handleLocalEchoUpdated);
    };
  }, [room, setTimeline]);
};
