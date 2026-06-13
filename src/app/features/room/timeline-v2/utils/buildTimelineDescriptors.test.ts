import { describe, it, expect } from 'vitest';
import type { EventTimelineSet } from 'matrix-js-sdk';
import type { TimelineEventInput, TimelineItem } from '../../../../utils/buildTimelineDescriptors';
import {
  MATRIX_BATCH_ID_PROPERTY_NAME,
  MATRIX_BATCH_INDEX_PROPERTY_NAME,
} from '../../../../../types/matrix/common';
import { createMockMatrixEvent } from '../../../../../test/mocks';
import { buildTimelineDescriptors } from './buildTimelineDescriptors';

const OTHER_USER = '@alice:example.com';
const FAKE_TIMELINE_SET = {} as EventTimelineSet;
const ONE_DAY_MS = 24 * 60 * 60 * 1000;

const makeEvent = (opts: {
  id: string;
  sender?: string;
  ts?: number;
  type?: string;
  content?: Record<string, unknown>;
}): TimelineEventInput => ({
  mEvent: createMockMatrixEvent({
    id: opts.id,
    sender: opts.sender ?? OTHER_USER,
    ts: opts.ts ?? 1000,
    type: opts.type ?? 'm.room.message',
    content: opts.content,
  }),
  mEventId: opts.id,
  timelineSet: FAKE_TIMELINE_SET,
  item: 0,
});

const makeImageEvent = (opts: {
  id: string;
  ts?: number;
  batchId?: string;
  batchIndex?: number;
}): TimelineEventInput => {
  const content: Record<string, unknown> = {
    msgtype: 'm.image',
    body: 'image.png',
    url: `mxc://example.com/${opts.id}`,
    info: { w: 800, h: 600, mimetype: 'image/png' },
  };
  if (opts.batchId !== undefined) content[MATRIX_BATCH_ID_PROPERTY_NAME] = opts.batchId;
  if (opts.batchIndex !== undefined) content[MATRIX_BATCH_INDEX_PROPERTY_NAME] = opts.batchIndex;
  return makeEvent({ id: opts.id, ts: opts.ts, content });
};

const types = (items: TimelineItem[]): string[] =>
  items.map((d) => (d.type === 'event' ? `event:${d.mEventId}` : d.type));

const eventDescriptor = (items: TimelineItem[], id: string) =>
  items.find((d) => d.type === 'event' && d.mEventId === id) as
    | Extract<TimelineItem, { type: 'event' }>
    | undefined;

describe('buildTimelineDescriptors (v2)', () => {
  it('inserts the divider before the first-unread event and does not collapse it', () => {
    const events = [
      makeEvent({ id: '$a', ts: 1000 }),
      makeEvent({ id: '$b', ts: 1000 + 60_000 }),
      makeEvent({ id: '$c', ts: 1000 + 120_000 }),
    ];
    const result = buildTimelineDescriptors(events, '$b');
    expect(types(result)).toEqual(['event:$a', 'new-messages', 'event:$b', 'event:$c']);
    expect(eventDescriptor(result, '$b')?.collapsed).toBe(false);
  });

  it('renders no divider when there is no first-unread event', () => {
    const events = [makeEvent({ id: '$a' }), makeEvent({ id: '$b' }), makeEvent({ id: '$c' })];
    const result = buildTimelineDescriptors(events, undefined);
    expect(types(result)).toEqual(['event:$a', 'event:$b', 'event:$c']);
  });

  it('redirects the divider to the group anchor when the first-unread event is an absorbed image', () => {
    const events = [
      makeEvent({ id: '$msg', ts: 1000 }),
      makeImageEvent({ id: '$img1', ts: 2000, batchId: 'B', batchIndex: 0 }),
      makeImageEvent({ id: '$img2', ts: 2000, batchId: 'B', batchIndex: 1 }),
      makeImageEvent({ id: '$img3', ts: 2000, batchId: 'B', batchIndex: 2 }),
    ];
    const result = buildTimelineDescriptors(events, '$img2');
    expect(types(result)).toEqual(['event:$msg', 'new-messages', 'event:$img1']);
  });

  it('inserts day dividers across day boundaries and collapses consecutive same-sender messages', () => {
    const events = [
      makeEvent({ id: '$a', ts: 1000 }),
      makeEvent({ id: '$b', ts: 1000 + 60_000 }),
      makeEvent({ id: '$c', ts: 1000 + ONE_DAY_MS }),
    ];
    const result = buildTimelineDescriptors(events, undefined);
    expect(types(result)).toEqual(['event:$a', 'event:$b', 'day-divider', 'event:$c']);
    expect(eventDescriptor(result, '$b')?.collapsed).toBe(true);
    expect(eventDescriptor(result, '$c')?.collapsed).toBe(false);
  });
});
