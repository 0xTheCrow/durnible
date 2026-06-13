import { describe, it, expect } from 'vitest';
import type { EventTimeline, EventTimelineSet, MatrixEvent } from 'matrix-js-sdk';
import { createMockMatrixEvent } from '../../../../../test/mocks';
import { resolveTimelineEvents } from './resolveTimelineEvents';

const MY_USER = '@me:example.com';
const OTHER_USER = '@alice:example.com';
const TIMELINE_SET = {} as EventTimelineSet;

const event = (id: string, sender: string = OTHER_USER): MatrixEvent =>
  createMockMatrixEvent({ id, sender });

const resolve = (
  events: MatrixEvent[],
  readUptoEventId: string | undefined,
  hidden: string[] = []
) => {
  const hiddenSet = new Set(hidden);
  const willRender = (mEvent: MatrixEvent) => !hiddenSet.has(mEvent.getId() ?? '');
  const timeline = {
    getEvents: () => events,
    getTimelineSet: () => TIMELINE_SET,
  } as unknown as EventTimeline;
  const items = events.map((_, index) => index);
  return resolveTimelineEvents([timeline], items, willRender, readUptoEventId, MY_USER);
};

describe('resolveTimelineEvents', () => {
  it('anchors the boundary on the first event from another user after a rendered readUpTo', () => {
    const { firstUnreadEventId } = resolve(
      [event('$a'), event('$readUpTo'), event('$b'), event('$c')],
      '$readUpTo'
    );
    expect(firstUnreadEventId).toBe('$b');
  });

  it('resolves the boundary past a non-rendering readUpTo to the next rendered event', () => {
    const { events, firstUnreadEventId } = resolve(
      [event('$a'), event('$readUpTo'), event('$b')],
      '$readUpTo',
      ['$readUpTo']
    );
    expect(firstUnreadEventId).toBe('$b');
    expect(events.map((e) => e.mEventId)).toEqual(['$a', '$b']);
  });

  it('skips own messages and anchors on the first message from another user', () => {
    const { firstUnreadEventId } = resolve(
      [event('$readUpTo'), event('$mine', MY_USER), event('$other')],
      '$readUpTo'
    );
    expect(firstUnreadEventId).toBe('$other');
  });

  it('returns no boundary when readUpTo is the last event', () => {
    const { firstUnreadEventId } = resolve([event('$a'), event('$readUpTo')], '$readUpTo');
    expect(firstUnreadEventId).toBeUndefined();
  });

  it('returns no boundary when readUpTo is not in the window', () => {
    const { firstUnreadEventId } = resolve([event('$a'), event('$b')], '$missing');
    expect(firstUnreadEventId).toBeUndefined();
  });
});
