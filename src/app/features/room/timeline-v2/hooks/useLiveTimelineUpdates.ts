import type { Dispatch, SetStateAction, RefObject } from 'react';
import { useCallback } from 'react';
import type { MatrixEvent, Room } from 'matrix-js-sdk';
import { useLiveEventArrive } from '../../timeline/timelineState';
import type { Timeline } from '../../timeline/timelineState';
import { isModifierTimelineEvent } from '../../../../utils/room';

type UseLiveTimelineUpdatesParams = {
  room: Room;
  setTimeline: Dispatch<SetStateAction<Timeline>>;
  nearBottomRef: RefObject<boolean>;
  isInLivePaginationWindowRef: RefObject<boolean>;
  unfocusedAutoScroll: boolean;
};

export const useLiveTimelineUpdates = ({
  room,
  setTimeline,
  nearBottomRef,
  isInLivePaginationWindowRef,
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
    [setTimeline, nearBottomRef, isInLivePaginationWindowRef, unfocusedAutoScroll]
  );

  useLiveEventArrive(room, handleArrive);
};
