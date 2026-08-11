import type { Dispatch, SetStateAction } from 'react';
import { useCallback, useState } from 'react';
import type { Room } from 'matrix-js-sdk';
import { Direction } from 'matrix-js-sdk';
import { useMatrixClient } from '../../../../hooks/useMatrixClient';
import { PAGINATION_LIMIT, useTimelinePagination } from '../timelineState';
import type { Timeline, TimelineRange } from '../timelineState';
import {
  getLiveTimeline,
  getTimelineAndBaseIndex,
  getTimelineEvent,
  getTimelineRelativeIndex,
  getTimelinesEventsCount,
} from '../timelineUtils';
import { isModifierTimelineEvent } from '../../../../utils/room';

export type PaginationState = {
  handleTimelinePagination: (backwards: boolean) => Promise<void>;
  canPaginateBack: boolean;
  rangeAtOldest: boolean;
  isForwardPaginating: boolean;
  liveTimelineLinked: boolean;
  rangeAtNewest: boolean;
};

export const usePaginationState = (
  room: Room,
  timeline: Timeline,
  range: TimelineRange,
  setTimeline: Dispatch<SetStateAction<Timeline>>
): PaginationState => {
  const mx = useMatrixClient();
  const [isForwardPaginating, setIsForwardPaginating] = useState(false);

  const handleTimelinePagination = useTimelinePagination(
    mx,
    timeline,
    setTimeline,
    PAGINATION_LIMIT,
    useCallback((backwards: boolean, fetching: boolean) => {
      if (!backwards) setIsForwardPaginating(fetching);
    }, [])
  );

  const canPaginateBack =
    typeof timeline.linkedTimelines[0]?.getPaginationToken(Direction.Backward) === 'string';
  const rangeAtOldest = range.oldest === 0;

  const liveTimelineLinked =
    timeline.linkedTimelines[timeline.linkedTimelines.length - 1] === getLiveTimeline(room);

  const eventsLength = getTimelinesEventsCount(timeline.linkedTimelines);
  const rangeAtNewest = (() => {
    if (range.newest >= eventsLength) return true;
    for (let i = range.newest; i < eventsLength; i += 1) {
      const [eventTimeline, base] = getTimelineAndBaseIndex(timeline.linkedTimelines, i);
      if (!eventTimeline) continue;
      const matrixEvent = getTimelineEvent(eventTimeline, getTimelineRelativeIndex(i, base));
      if (matrixEvent && !isModifierTimelineEvent(matrixEvent)) return false;
    }
    return true;
  })();

  return {
    handleTimelinePagination,
    canPaginateBack,
    rangeAtOldest,
    isForwardPaginating,
    liveTimelineLinked,
    rangeAtNewest,
  };
};
