import { describe, it, expect, vi } from 'vitest';
import type { MatrixEvent, Room } from 'matrix-js-sdk';
import { EventType, RelationType } from 'matrix-js-sdk';
import {
  computeReactionBucketCreatedAt,
  getReactionBucketCreatedAt,
  sortReactionBuckets,
} from './editing';
import { MATRIX_REACTION_BUCKET_CREATED_AT_PROPERTY_NAME } from '../../../types/matrix/common';
import { createMockMatrixEvent } from '../../../test/mocks';

const TARGET_EVENT_ID = '$target:example.com';

type ReactionOptions = {
  id?: string;
  key: string;
  ts: number;
  stamp?: number;
  targetEventId?: string;
  relationType?: string;
  redacted?: boolean;
};

function createReactionEvent(opts: ReactionOptions): MatrixEvent {
  const relatesTo = {
    event_id: opts.targetEventId ?? TARGET_EVENT_ID,
    key: opts.key,
    rel_type: opts.relationType ?? RelationType.Annotation,
  };
  const content: Record<string, unknown> = { 'm.relates_to': relatesTo };
  if (opts.stamp !== undefined) {
    content[MATRIX_REACTION_BUCKET_CREATED_AT_PROPERTY_NAME] = opts.stamp;
  }
  const event = createMockMatrixEvent({
    id: opts.id,
    type: EventType.Reaction,
    ts: opts.ts,
    content,
    redacted: opts.redacted,
  });
  return Object.assign(event, {
    getRelation: vi.fn(() => relatesTo),
    isRelation: vi.fn(() => true),
  });
}

function createRoomWithTimelines(...timelines: MatrixEvent[][]): Room {
  return {
    getUnfilteredTimelineSet: () => ({
      getTimelines: () => timelines.map((events) => ({ getEvents: () => events })),
    }),
  } as unknown as Room;
}

const keysOf = (buckets: [string, Set<MatrixEvent>][]): string[] => buckets.map(([key]) => key);

describe('getReactionBucketCreatedAt', () => {
  it('falls back to origin_server_ts when the stamp is not a number', () => {
    const event = createMockMatrixEvent({
      type: EventType.Reaction,
      ts: 777,
      content: { [MATRIX_REACTION_BUCKET_CREATED_AT_PROPERTY_NAME]: 'not-a-number' },
    });
    expect(getReactionBucketCreatedAt(event)).toBe(777);
  });
});

describe('sortReactionBuckets', () => {
  it('orders buckets by effective created-at, using the stamp when present and getTs otherwise', () => {
    const buckets = sortReactionBuckets([
      createReactionEvent({ key: 'a', ts: 100 }),
      createReactionEvent({ key: 'b', ts: 400, stamp: 50 }),
      createReactionEvent({ key: 'c', ts: 200 }),
    ]);
    expect(keysOf(buckets)).toEqual(['b', 'a', 'c']);
  });

  it('keeps a bucket in place after the originator unreacts when a survivor carries the stamp', () => {
    // The originator's earliest reaction is redacted, so it is absent from getRelations().
    // A later survivor (getTs 300) carries the original time (50) as its stamp.
    const stockBucket = createReactionEvent({ key: 'stock', ts: 200 });
    const survivorWithStamp = createReactionEvent({ key: 'custom', ts: 300, stamp: 50 });
    expect(keysOf(sortReactionBuckets([stockBucket, survivorWithStamp]))).toEqual([
      'custom',
      'stock',
    ]);

    // Control: the same survivor without the stamp loses its position.
    const survivorWithoutStamp = createReactionEvent({ key: 'custom', ts: 300 });
    expect(keysOf(sortReactionBuckets([stockBucket, survivorWithoutStamp]))).toEqual([
      'stock',
      'custom',
    ]);
  });

  it('breaks created-at ties by smallest event id, regardless of input order', () => {
    const earlierId = createReactionEvent({ id: '$a', key: 'q', ts: 100 });
    const laterId = createReactionEvent({ id: '$b', key: 'p', ts: 100 });
    expect(keysOf(sortReactionBuckets([laterId, earlierId]))).toEqual(['q', 'p']);
    expect(keysOf(sortReactionBuckets([earlierId, laterId]))).toEqual(['q', 'p']);
  });
});

describe('computeReactionBucketCreatedAt', () => {
  it('returns undefined when no reaction with that key exists', () => {
    const room = createRoomWithTimelines([
      createMockMatrixEvent({ type: EventType.RoomMessage, ts: 10 }),
    ]);
    expect(computeReactionBucketCreatedAt(room, TARGET_EVENT_ID, '👍')).toBeUndefined();
  });

  it('returns the earliest effective created-at, preferring a carried stamp over a later getTs', () => {
    const room = createRoomWithTimelines([
      createReactionEvent({ key: '👍', ts: 300 }),
      createReactionEvent({ key: '👍', ts: 200, stamp: 100 }),
    ]);
    expect(computeReactionBucketCreatedAt(room, TARGET_EVENT_ID, '👍')).toBe(100);
  });

  it('scans every timeline, not only the live one', () => {
    const liveTimeline = [createReactionEvent({ key: '👍', ts: 300 })];
    const olderTimeline = [createReactionEvent({ key: '👍', ts: 120 })];
    const room = createRoomWithTimelines(liveTimeline, olderTimeline);
    expect(computeReactionBucketCreatedAt(room, TARGET_EVENT_ID, '👍')).toBe(120);
  });

  it('ignores redacted reactions and reactions for other targets or keys', () => {
    const room = createRoomWithTimelines([
      createReactionEvent({ key: '👍', ts: 200 }),
      createReactionEvent({ key: '👍', ts: 50, redacted: true }),
      createReactionEvent({ key: '👍', ts: 10, targetEventId: '$other:example.com' }),
      createReactionEvent({ key: '🎉', ts: 20 }),
      createMockMatrixEvent({ type: EventType.RoomMessage, ts: 5 }),
    ]);
    expect(computeReactionBucketCreatedAt(room, TARGET_EVENT_ID, '👍')).toBe(200);
  });
});
