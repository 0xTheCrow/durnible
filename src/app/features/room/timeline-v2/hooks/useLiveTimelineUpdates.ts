import type { Dispatch, SetStateAction, RefObject } from 'react';
import { useCallback, useEffect } from 'react';
import type { MatrixEvent, Room, RoomEventHandlerMap } from 'matrix-js-sdk';
import { RoomEvent } from 'matrix-js-sdk';
import { useLiveEventArrive } from '../../timeline/timelineState';
import type { Timeline } from '../../timeline/timelineState';
import { isModifierTimelineEvent } from '../../../../utils/room';

type UseLiveTimelineUpdatesParams = {
  room: Room;
  setTimeline: Dispatch<SetStateAction<Timeline>>;
  nearBottomRef: RefObject<boolean>;
  isInLivePaginationWindowRef: RefObject<boolean>;
  pinToLiveEnd: () => void;
  unfocusedAutoScroll: boolean;
};

export const useLiveTimelineUpdates = ({
  room,
  setTimeline,
  nearBottomRef,
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

      if (nearBottomRef.current && isInLivePaginationWindowRef.current && autoPinEnabled) {
        pinToLiveEnd();
        setTimeline((current) => ({
          ...current,
          range: {
            oldest: current.range.oldest + 1,
            newest: current.range.newest + 1,
          },
        }));
        return;
      }

      setTimeline((current) => ({ ...current }));
    },
    [setTimeline, nearBottomRef, isInLivePaginationWindowRef, pinToLiveEnd, unfocusedAutoScroll]
  );

  useLiveEventArrive(room, handleArrive);

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
