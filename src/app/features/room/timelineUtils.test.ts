import { describe, it, expect } from 'vitest';
import type { EventTimeline, MatrixEvent } from 'matrix-js-sdk';
import { Direction } from 'matrix-js-sdk';
import {
  getEventIdAbsoluteIndex,
  getFirstLinkedTimeline,
  getLinkedTimelines,
  getTimelineAndBaseIndex,
  getTimelinesEventsCount,
} from './timelineUtils';
import { createMockMatrixEvent } from '../../../test/mocks';

// ─── Fake EventTimeline chain ─────────────────────────────────────────────
// These functions only use `getEvents()` and `getNeighbouringTimeline(direction)`,
// so a minimal shape is enough — no need to construct real matrix-js-sdk timelines.

type FakeTimeline = EventTimeline & {
  __prev: FakeTimeline | null;
  __next: FakeTimeline | null;
  __events: MatrixEvent[];
};

function makeTimeline(events: MatrixEvent[] = []): FakeTimeline {
  const tl = {
    __prev: null,
    __next: null,
    __events: events,
    getEvents: () => tl.__events,
    getNeighbouringTimeline: (direction: Direction) =>
      direction === Direction.Backward ? tl.__prev : tl.__next,
  } as unknown as FakeTimeline;
  return tl;
}

function makeChain(...eventGroups: MatrixEvent[][]): FakeTimeline[] {
  const chain: FakeTimeline[] = eventGroups.map((events) => makeTimeline(events));
  for (let i = 0; i < chain.length - 1; i += 1) {
    chain[i].__next = chain[i + 1];
    chain[i + 1].__prev = chain[i];
  }
  return chain;
}

function makeEvent(id: string): MatrixEvent {
  return createMockMatrixEvent({ id });
}

// ─── getFirstLinkedTimeline ───────────────────────────────────────────────

describe('getFirstLinkedTimeline', () => {
  it('returns the same timeline when it has no neighbour in that direction', () => {
    const only = makeTimeline([makeEvent('$a')]);
    expect(getFirstLinkedTimeline(only, Direction.Backward)).toBe(only);
    expect(getFirstLinkedTimeline(only, Direction.Forward)).toBe(only);
  });

  it('walks backward through the chain to the oldest timeline', () => {
    const [a, , c] = makeChain([makeEvent('$a')], [makeEvent('$b')], [makeEvent('$c')]);
    expect(getFirstLinkedTimeline(c, Direction.Backward)).toBe(a);
  });

  it('walks forward through the chain to the newest timeline', () => {
    const [a, , c] = makeChain([makeEvent('$a')], [makeEvent('$b')], [makeEvent('$c')]);
    expect(getFirstLinkedTimeline(a, Direction.Forward)).toBe(c);
  });
});

// ─── getLinkedTimelines ───────────────────────────────────────────────────

describe('getLinkedTimelines', () => {
  it('returns a single-element array for an isolated timeline', () => {
    const only = makeTimeline([makeEvent('$a')]);
    expect(getLinkedTimelines(only)).toEqual([only]);
  });

  it('returns the chain in oldest-to-newest order regardless of the input node', () => {
    const [a, b, c] = makeChain([makeEvent('$a')], [makeEvent('$b')], [makeEvent('$c')]);
    expect(getLinkedTimelines(a)).toEqual([a, b, c]);
    expect(getLinkedTimelines(b)).toEqual([a, b, c]);
    expect(getLinkedTimelines(c)).toEqual([a, b, c]);
  });
});

// ─── getTimelinesEventsCount ──────────────────────────────────────────────

describe('getTimelinesEventsCount', () => {
  it('returns 0 for an empty list', () => {
    expect(getTimelinesEventsCount([])).toBe(0);
  });

  it('returns the sum of events across all supplied timelines', () => {
    const a = makeTimeline([makeEvent('$a1'), makeEvent('$a2')]);
    const b = makeTimeline([makeEvent('$b1')]);
    const c = makeTimeline([makeEvent('$c1'), makeEvent('$c2'), makeEvent('$c3')]);
    expect(getTimelinesEventsCount([a, b, c])).toBe(6);
  });
});

// ─── getTimelineAndBaseIndex ──────────────────────────────────────────────

describe('getTimelineAndBaseIndex', () => {
  // a: indices 0, 1 — b: 2, 3, 4 — c: 5
  const chain = makeChain(
    [makeEvent('$a1'), makeEvent('$a2')],
    [makeEvent('$b1'), makeEvent('$b2'), makeEvent('$b3')],
    [makeEvent('$c1')]
  );
  const [a, b, c] = chain;

  it('returns the first timeline with base 0 for index 0', () => {
    expect(getTimelineAndBaseIndex(chain, 0)).toEqual([a, 0]);
  });

  it('returns the first timeline for an index still inside its range', () => {
    expect(getTimelineAndBaseIndex(chain, 1)).toEqual([a, 0]);
  });

  it('returns the second timeline with its correct base at the boundary', () => {
    expect(getTimelineAndBaseIndex(chain, 2)).toEqual([b, 2]);
  });

  it('returns the last timeline with its base for the final index', () => {
    expect(getTimelineAndBaseIndex(chain, 5)).toEqual([c, 5]);
  });

  it('returns [undefined, 0] when the index is past the end of the chain', () => {
    expect(getTimelineAndBaseIndex(chain, 6)).toEqual([undefined, 0]);
  });
});

// ─── getEventIdAbsoluteIndex ──────────────────────────────────────────────

describe('getEventIdAbsoluteIndex', () => {
  it('returns the correct absolute index for an event in the first timeline', () => {
    const chain = makeChain([makeEvent('$a1'), makeEvent('$a2')], [makeEvent('$b1')]);
    const [a] = chain;
    expect(getEventIdAbsoluteIndex(chain, a, '$a2')).toBe(1);
  });

  it('adds the preceding timelines length to an event in a later timeline', () => {
    const chain = makeChain(
      [makeEvent('$a1'), makeEvent('$a2')],
      [makeEvent('$b1'), makeEvent('$b2'), makeEvent('$b3')],
      [makeEvent('$c1')]
    );
    const [, b, c] = chain;
    expect(getEventIdAbsoluteIndex(chain, b, '$b2')).toBe(3);
    expect(getEventIdAbsoluteIndex(chain, c, '$c1')).toBe(5);
  });

  it('returns undefined when the event is not present in the supplied timeline', () => {
    const chain = makeChain([makeEvent('$a1'), makeEvent('$a2')], [makeEvent('$b1')]);
    const [a] = chain;
    expect(getEventIdAbsoluteIndex(chain, a, '$b1')).toBeUndefined();
  });

  it('returns undefined when the supplied timeline is not in the list', () => {
    const a = makeTimeline([makeEvent('$a1')]);
    const stray = makeTimeline([makeEvent('$x1')]);
    expect(getEventIdAbsoluteIndex([a], stray, '$x1')).toBeUndefined();
  });
});
