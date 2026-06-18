import type { Dispatch, SetStateAction, RefObject } from 'react';
import { useCallback, useEffect } from 'react';
import type { MatrixEvent, Room, RoomEventHandlerMap } from 'matrix-js-sdk';
import { RoomEvent } from 'matrix-js-sdk';
import { useLiveEventArrive, useLiveEventDecryption } from '../../timeline/timelineState';
import type { Timeline } from '../../timeline/timelineState';
import { getTimelinesEventsCount } from '../../timeline/timelineUtils';
import { isModifierTimelineEvent } from '../../../../utils/room';
import { getScrollBottomDistance } from '../../../../utils/dom';

export const NEAR_BOTTOM_THRESHOLD_PX = 20;

type UseLiveTimelineUpdatesParams = {
  room: Room;
  setTimeline: Dispatch<SetStateAction<Timeline>>;
  scrollRef: RefObject<HTMLDivElement>;
  isInLivePaginationWindowRef: RefObject<boolean>;
  pinToLiveEnd: () => void;
  unfocusedAutoScroll: boolean;
};

export const useLiveTimelineUpdates = ({
  room,
  setTimeline,
  scrollRef,
  isInLivePaginationWindowRef,
  pinToLiveEnd,
  unfocusedAutoScroll,
}: UseLiveTimelineUpdatesParams): void => {
  const handleArrive = useCallback(
    (mEvent: MatrixEvent) => {
      const isModifier = isModifierTimelineEvent(mEvent);

      if (isModifier) {
        setTimeline((current) => ({ ...current }));
        return;
      }

      const focused = typeof document !== 'undefined' && document.hasFocus();
      const autoPinEnabled = focused || unfocusedAutoScroll;

      const scrollElement = scrollRef.current;
      const isNearBottom =
        !!scrollElement && getScrollBottomDistance(scrollElement) <= NEAR_BOTTOM_THRESHOLD_PX;

      if (isNearBottom && isInLivePaginationWindowRef.current && autoPinEnabled) {
        pinToLiveEnd();
        setTimeline((current) => {
          const total = getTimelinesEventsCount(current.linkedTimelines);
          const windowSize = current.range.newest - current.range.oldest;
          return {
            ...current,
            range: {
              oldest: Math.max(0, total - windowSize),
              newest: total,
            },
          };
        });
        return;
      }

      setTimeline((current) => ({ ...current }));
    },
    [setTimeline, scrollRef, isInLivePaginationWindowRef, pinToLiveEnd, unfocusedAutoScroll]
  );

  useLiveEventArrive(room, handleArrive);

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
