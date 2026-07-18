import React from 'react';
import { renderHook } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import type { EventTimeline, MatrixClient, MatrixEvent, Room } from 'matrix-js-sdk';
import { RelationType } from 'matrix-js-sdk';
import { MatrixClientProvider } from '../../../../hooks/useMatrixClient';
import { createMockMatrixClient, createMockRoom } from '../../../../../test/mocks';
import type { Timeline } from '../timelineState';
import { usePaginationState } from './usePaginationState';

const messageEvent = (): MatrixEvent =>
  ({
    getId: () => '$m',
    getType: () => 'm.room.message',
    getRelation: () => null,
    isRedaction: () => false,
    isRedacted: () => false,
  } as unknown as MatrixEvent);

const reactionEvent = (): MatrixEvent =>
  ({
    getId: () => '$r',
    getType: () => 'm.reaction',
    getRelation: () => ({ rel_type: RelationType.Annotation }),
    isRedaction: () => false,
    isRedacted: () => false,
  } as unknown as MatrixEvent);

const makeTimeline = (events: MatrixEvent[]): EventTimeline =>
  ({
    getEvents: () => events,
    getPaginationToken: () => null,
    getTimelineSet: () => ({}),
  } as unknown as EventTimeline);

const makeTimelineState = (linked: EventTimeline, newest: number): Timeline => ({
  linkedTimelines: [linked],
  range: { oldest: 0, newest },
});

const mx = createMockMatrixClient();
const wrapper = ({ children }: { children: React.ReactNode }) =>
  React.createElement(MatrixClientProvider, { value: mx as unknown as MatrixClient }, children);

const render = (timeline: Timeline) => {
  const room = createMockRoom();
  return renderHook(() => usePaginationState(room as unknown as Room, timeline, () => {}), {
    wrapper,
  });
};

describe('usePaginationState', () => {
  it('reports rangeAtNewest when the range covers every loaded event', () => {
    const timeline = makeTimelineState(
      makeTimeline([messageEvent(), messageEvent(), messageEvent()]),
      3
    );
    const { result } = render(timeline);
    expect(result.current.rangeAtNewest).toBe(true);
  });

  it('is not at newest when a renderable event sits beyond the range', () => {
    const timeline = makeTimelineState(
      makeTimeline([messageEvent(), messageEvent(), messageEvent()]),
      1
    );
    const { result } = render(timeline);
    expect(result.current.rangeAtNewest).toBe(false);
  });

  it('stays at newest when only modifier events sit beyond the range', () => {
    const timeline = makeTimelineState(
      makeTimeline([messageEvent(), reactionEvent(), reactionEvent()]),
      1
    );
    const { result } = render(timeline);
    expect(result.current.rangeAtNewest).toBe(true);
  });
});
