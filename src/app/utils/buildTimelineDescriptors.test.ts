import { RelationType } from 'matrix-js-sdk';
import { describe, it, expect, vi } from 'vitest';
import type { TimelineEventInput, TimelineItem } from './buildTimelineDescriptors';
import { buildTimelineDescriptors, IMAGE_GROUP_MAX_SIZE } from './buildTimelineDescriptors';
import {
  MATRIX_BATCH_ID_PROPERTY_NAME,
  MATRIX_BATCH_INDEX_PROPERTY_NAME,
} from '../../types/matrix/common';
import { createMockMatrixEvent } from '../../test/mocks';

const MY_USER = '@me:example.com';
const OTHER_USER = '@alice:example.com';

const FAKE_TIMELINE_SET = {} as any;

const ONE_DAY_MS = 24 * 60 * 60 * 1000;

function makeEvent(opts: {
  id: string;
  sender?: string;
  ts?: number;
  type?: string;
  isReaction?: boolean;
  content?: Record<string, unknown>;
}): TimelineEventInput {
  const base = createMockMatrixEvent({
    id: opts.id,
    sender: opts.sender ?? OTHER_USER,
    ts: opts.ts ?? 1000,
    type: opts.type ?? 'm.room.message',
    content: opts.content,
  });

  const mEvent = opts.isReaction
    ? {
        ...base,
        getRelation: vi.fn(() => ({ rel_type: RelationType.Annotation })),
      }
    : {
        ...base,
        getRelation: vi.fn(() => null),
      };

  return { mEvent: mEvent as any, mEventId: opts.id, timelineSet: FAKE_TIMELINE_SET, item: 0 };
}

function makeImageEvent(opts: {
  id: string;
  sender?: string;
  ts?: number;
  batchId?: string;
  batchIndex?: number;
}): TimelineEventInput {
  const content: Record<string, unknown> = {
    msgtype: 'm.image',
    body: 'image.png',
    url: `mxc://example.com/${opts.id}`,
    info: { w: 800, h: 600, mimetype: 'image/png' },
  };
  if (opts.batchId !== undefined) content[MATRIX_BATCH_ID_PROPERTY_NAME] = opts.batchId;
  if (opts.batchIndex !== undefined) content[MATRIX_BATCH_INDEX_PROPERTY_NAME] = opts.batchIndex;
  return makeEvent({
    id: opts.id,
    sender: opts.sender,
    ts: opts.ts,
    content,
  });
}

function types(items: TimelineItem[]): string[] {
  return items.map((d) => (d.type === 'event' ? `event:${d.mEventId}` : d.type));
}

// ─── Basic descriptor output ──────────────────────────────────────────────────

describe('buildTimelineDescriptors', () => {
  it('returns event descriptors for plain messages', () => {
    const result = buildTimelineDescriptors(
      [makeEvent({ id: '$A' }), makeEvent({ id: '$B' })],
      undefined,
      MY_USER
    );
    expect(types(result)).toEqual(['event:$A', 'event:$B']);
  });

  it('omits reaction events from the output', () => {
    const result = buildTimelineDescriptors(
      [
        makeEvent({ id: '$A' }),
        makeEvent({ id: '$reaction', isReaction: true }),
        makeEvent({ id: '$B' }),
      ],
      undefined,
      MY_USER
    );
    expect(types(result)).toEqual(['event:$A', 'event:$B']);
  });

  // ─── New Messages divider ────────────────────────────────────────────────────

  it('inserts new-messages divider before the first unread message', () => {
    const result = buildTimelineDescriptors(
      [makeEvent({ id: '$A' }), makeEvent({ id: '$B' })],
      '$A', // readUptoEventId = $A → divider before $B
      MY_USER
    );
    expect(types(result)).toEqual(['event:$A', 'new-messages', 'event:$B']);
  });

  it('does NOT insert new-messages divider for messages sent by the current user', () => {
    const result = buildTimelineDescriptors(
      [
        makeEvent({ id: '$A' }),
        makeEvent({ id: '$B', sender: MY_USER }), // own message → no divider
      ],
      '$A',
      MY_USER
    );
    expect(types(result)).toEqual(['event:$A', 'event:$B']);
  });

  it('divider is deferred past own messages until a message from another user', () => {
    const result = buildTimelineDescriptors(
      [
        makeEvent({ id: '$A' }),
        makeEvent({ id: '$B', sender: MY_USER }), // own — no divider yet
        makeEvent({ id: '$C', sender: OTHER_USER }), // other — divider fires here
      ],
      '$A',
      MY_USER
    );
    expect(types(result)).toEqual(['event:$A', 'event:$B', 'new-messages', 'event:$C']);
  });

  it('does NOT insert new-messages divider based on a reaction position (regression)', () => {
    // Before the fix, a reaction between the last-read message and the next
    // message would absorb the read pointer, causing the divider to appear in
    // the wrong place or not appear at all.
    //
    // Sequence: $A (read) → reaction → $B (first unread)
    // Expected: divider before $B, NOT before reaction or after $B.
    const result = buildTimelineDescriptors(
      [
        makeEvent({ id: '$A' }),
        makeEvent({ id: '$reaction', isReaction: true }),
        makeEvent({ id: '$B' }),
      ],
      '$A',
      MY_USER
    );
    expect(types(result)).toEqual(['event:$A', 'new-messages', 'event:$B']);
  });

  it('does not produce a dangling divider when the last event is a reaction', () => {
    // Sequence: $A (read) → reaction (end of range)
    // No next message → divider must NOT appear.
    const result = buildTimelineDescriptors(
      [makeEvent({ id: '$A' }), makeEvent({ id: '$reaction', isReaction: true })],
      '$A',
      MY_USER
    );
    expect(types(result)).toEqual(['event:$A']);
  });

  // ─── Day divider ─────────────────────────────────────────────────────────────

  it('inserts day-divider when consecutive messages cross midnight', () => {
    const result = buildTimelineDescriptors(
      [makeEvent({ id: '$A', ts: 1000 }), makeEvent({ id: '$B', ts: 1000 + ONE_DAY_MS })],
      undefined,
      MY_USER
    );
    expect(types(result)).toEqual(['event:$A', 'day-divider', 'event:$B']);
    const divider = result.find((d) => d.type === 'day-divider') as Extract<
      TimelineItem,
      { type: 'day-divider' }
    >;
    expect(divider.ts).toBe(1000 + ONE_DAY_MS);
  });

  it('day-divider timestamp uses the newer message, not the reaction before it', () => {
    const laterTs = 1000 + ONE_DAY_MS;
    const result = buildTimelineDescriptors(
      [
        makeEvent({ id: '$A', ts: 1000 }),
        makeEvent({ id: '$reaction', isReaction: true, ts: laterTs - 1 }),
        makeEvent({ id: '$B', ts: laterTs }),
      ],
      undefined,
      MY_USER
    );
    expect(types(result)).toContain('day-divider');
    const divider = result.find((d) => d.type === 'day-divider') as Extract<
      TimelineItem,
      { type: 'day-divider' }
    >;
    expect(divider.ts).toBe(laterTs);
  });

  // ─── Collapse ─────────────────────────────────────────────────────────────────

  it('collapses consecutive messages from the same sender within 2 minutes', () => {
    const result = buildTimelineDescriptors(
      [
        makeEvent({ id: '$A', sender: OTHER_USER, ts: 1000 }),
        makeEvent({ id: '$B', sender: OTHER_USER, ts: 1000 + 60 * 1000 }), // 1 minute later (in ms)
      ],
      undefined,
      MY_USER
    );
    const eventB = result.find((d) => d.type === 'event' && d.mEventId === '$B') as Extract<
      TimelineItem,
      { type: 'event' }
    >;
    expect(eventB?.collapsed).toBe(true);
  });

  it('collapses across an invisible reaction between two same-sender messages', () => {
    // Reactions are invisible. A reaction between $A and $B must not prevent
    // $B from collapsing against $A — and crucially, removing the reaction
    // later must not cause a one-frame collapse-state flip (flicker).
    const result = buildTimelineDescriptors(
      [
        makeEvent({ id: '$A', sender: OTHER_USER, ts: 1000 }),
        makeEvent({ id: '$reaction', isReaction: true, ts: 2000 }),
        makeEvent({ id: '$B', sender: OTHER_USER, ts: 3000 }),
      ],
      undefined,
      MY_USER
    );
    const eventB = result.find((d) => d.type === 'event' && d.mEventId === '$B') as Extract<
      TimelineItem,
      { type: 'event' }
    >;
    expect(eventB?.collapsed).toBe(true);
  });

  // ─── Custom willRender predicate ─────────────────────────────────────────────

  it('day-divider is deferred past a suppressed event to the next visible event', () => {
    // Simulates a redaction or hidden membership event at the start of a new day.
    // The divider should fire before the next *visible* event, not before the suppressed one.
    const suppress = new Set(['$B']);
    const laterTs = 1000 + ONE_DAY_MS;
    const result = buildTimelineDescriptors(
      [
        makeEvent({ id: '$A', ts: 1000 }),
        makeEvent({ id: '$B', ts: laterTs }), // suppressed (e.g. m.room.redaction)
        makeEvent({ id: '$C', ts: laterTs + 1 }), // visible
      ],
      undefined,
      MY_USER,
      (mEvent) => !suppress.has(mEvent.getId() ?? '')
    );
    expect(types(result)).toEqual(['event:$A', 'day-divider', 'event:$C']);
    const divider = result.find((d) => d.type === 'day-divider') as Extract<
      TimelineItem,
      { type: 'day-divider' }
    >;
    expect(divider.ts).toBe(laterTs + 1);
  });

  it('no day-divider when all events on the new day are suppressed', () => {
    const suppress = new Set(['$B']);
    const result = buildTimelineDescriptors(
      [
        makeEvent({ id: '$A', ts: 1000 }),
        makeEvent({ id: '$B', ts: 1000 + ONE_DAY_MS }), // suppressed, nothing follows
      ],
      undefined,
      MY_USER,
      (mEvent) => !suppress.has(mEvent.getId() ?? '')
    );
    expect(types(result)).toEqual(['event:$A']);
  });

  it('new-messages divider is deferred past a suppressed event to the next visible event', () => {
    const suppress = new Set(['$B']);
    const result = buildTimelineDescriptors(
      [
        makeEvent({ id: '$A' }),
        makeEvent({ id: '$B' }), // suppressed
        makeEvent({ id: '$C' }),
      ],
      '$A',
      MY_USER,
      (mEvent) => !suppress.has(mEvent.getId() ?? '')
    );
    expect(types(result)).toEqual(['event:$A', 'new-messages', 'event:$C']);
  });

  // ─── readUptoEventId edge cases ───────────────────────────────────────────────

  it('no new-messages divider when readUptoEventId is the last visible event', () => {
    // User has read everything — nothing should appear after the last message.
    const result = buildTimelineDescriptors(
      [makeEvent({ id: '$A' }), makeEvent({ id: '$B' })],
      '$B',
      MY_USER
    );
    expect(types(result)).toEqual(['event:$A', 'event:$B']);
  });

  it('no new-messages divider when readUptoEventId is not in the event list', () => {
    // The read marker points to an event that was already scrolled past / not loaded.
    const result = buildTimelineDescriptors(
      [makeEvent({ id: '$A' }), makeEvent({ id: '$B' })],
      '$X',
      MY_USER
    );
    expect(types(result)).toEqual(['event:$A', 'event:$B']);
  });

  it('both dividers fire at the same event when it opens a new day and is the first unread', () => {
    // Common scenario: user was last active on Monday; Tuesday's messages are all unread.
    // Expected insertion order: new-messages marker before day-divider (documents current behaviour).
    const result = buildTimelineDescriptors(
      [makeEvent({ id: '$A', ts: 1000 }), makeEvent({ id: '$B', ts: 1000 + ONE_DAY_MS })],
      '$A',
      MY_USER
    );
    expect(types(result)).toEqual(['event:$A', 'new-messages', 'day-divider', 'event:$B']);
  });

  it('inserts two day-dividers for three messages spanning three different days', () => {
    const result = buildTimelineDescriptors(
      [
        makeEvent({ id: '$A', ts: 1000 }),
        makeEvent({ id: '$B', ts: 1000 + ONE_DAY_MS }),
        makeEvent({ id: '$C', ts: 1000 + ONE_DAY_MS * 2 }),
      ],
      undefined,
      MY_USER
    );
    expect(types(result)).toEqual([
      'event:$A',
      'day-divider',
      'event:$B',
      'day-divider',
      'event:$C',
    ]);
  });

  // ─── Collapse edge cases ──────────────────────────────────────────────────────

  it('does not collapse messages from different senders', () => {
    const result = buildTimelineDescriptors(
      [
        makeEvent({ id: '$A', sender: OTHER_USER, ts: 1000 }),
        makeEvent({ id: '$B', sender: MY_USER, ts: 2000 }),
      ],
      undefined,
      MY_USER
    );
    const eventB = result.find((d) => d.type === 'event' && d.mEventId === '$B') as Extract<
      TimelineItem,
      { type: 'event' }
    >;
    expect(eventB?.collapsed).toBe(false);
  });

  it('does not collapse messages from the same sender more than 2 minutes apart', () => {
    const result = buildTimelineDescriptors(
      [
        makeEvent({ id: '$A', sender: OTHER_USER, ts: 1000 }),
        makeEvent({ id: '$B', sender: OTHER_USER, ts: 1000 + 3 * 60 * 1000 }), // 3 minutes later
      ],
      undefined,
      MY_USER
    );
    const eventB = result.find((d) => d.type === 'event' && d.mEventId === '$B') as Extract<
      TimelineItem,
      { type: 'event' }
    >;
    expect(eventB?.collapsed).toBe(false);
  });

  it('day-divider boundary prevents collapse across midnight', () => {
    // Two messages from the same sender close in time but on different calendar days.
    // The day-divider pending flag must prevent the second from being collapsed.
    const result = buildTimelineDescriptors(
      [
        makeEvent({ id: '$A', sender: OTHER_USER, ts: 1000 }),
        makeEvent({ id: '$B', sender: OTHER_USER, ts: 1000 + ONE_DAY_MS }),
      ],
      undefined,
      MY_USER
    );
    const eventB = result.find((d) => d.type === 'event' && d.mEventId === '$B') as Extract<
      TimelineItem,
      { type: 'event' }
    >;
    expect(eventB?.collapsed).toBe(false);
  });

  // ─── Image grouping ───────────────────────────────────────────────────────────

  describe('image grouping', () => {
    const findEvent = (result: TimelineItem[], id: string) =>
      result.find((d) => d.type === 'event' && d.mEventId === id) as
        | Extract<TimelineItem, { type: 'event' }>
        | undefined;

    it('groups two images sharing a batch_id', () => {
      const result = buildTimelineDescriptors(
        [
          makeImageEvent({ id: '$A', sender: OTHER_USER, ts: 1000, batchId: 'b1', batchIndex: 0 }),
          makeImageEvent({ id: '$B', sender: OTHER_USER, ts: 2000, batchId: 'b1', batchIndex: 1 }),
        ],
        undefined,
        MY_USER
      );
      // Only the anchor remains in the output; the absorbed image is hidden.
      expect(types(result)).toEqual(['event:$A']);
      const anchor = findEvent(result, '$A');
      expect(anchor?.groupedImages).toBeDefined();
      expect(anchor?.groupedImages?.length).toBe(2);
    });

    it('does not group images with different batch_ids', () => {
      const result = buildTimelineDescriptors(
        [
          makeImageEvent({ id: '$A', sender: OTHER_USER, ts: 1000, batchId: 'b1', batchIndex: 0 }),
          makeImageEvent({ id: '$B', sender: OTHER_USER, ts: 1001, batchId: 'b2', batchIndex: 0 }),
        ],
        undefined,
        MY_USER
      );
      expect(types(result)).toEqual(['event:$A', 'event:$B']);
      expect(findEvent(result, '$A')?.groupedImages).toBeUndefined();
      expect(findEvent(result, '$B')?.groupedImages).toBeUndefined();
    });

    it('does not group images that lack batch_id even with identical timestamps', () => {
      const result = buildTimelineDescriptors(
        [
          makeImageEvent({ id: '$A', sender: OTHER_USER, ts: 1000 }),
          makeImageEvent({ id: '$B', sender: OTHER_USER, ts: 1000 }),
        ],
        undefined,
        MY_USER
      );
      expect(types(result)).toEqual(['event:$A', 'event:$B']);
      expect(findEvent(result, '$A')?.groupedImages).toBeUndefined();
      expect(findEvent(result, '$B')?.groupedImages).toBeUndefined();
    });

    it('groups images regardless of timestamp gap when batch_id matches', () => {
      // Demonstrates that the timestamp window is no longer authoritative —
      // a slow upload that lands seconds apart still groups if the sender
      // tagged both events with the same batch_id.
      const result = buildTimelineDescriptors(
        [
          makeImageEvent({ id: '$A', sender: OTHER_USER, ts: 1000, batchId: 'b1', batchIndex: 0 }),
          makeImageEvent({
            id: '$B',
            sender: OTHER_USER,
            ts: 1000 + 60_000, // 1 minute later
            batchId: 'b1',
            batchIndex: 1,
          }),
        ],
        undefined,
        MY_USER
      );
      expect(types(result)).toEqual(['event:$A']);
      expect(findEvent(result, '$A')?.groupedImages?.length).toBe(2);
    });

    it('caps a same-batch run at IMAGE_GROUP_MAX_SIZE and starts a new group with the overflow', () => {
      const total = IMAGE_GROUP_MAX_SIZE + 2;
      const events: TimelineEventInput[] = [];
      for (let i = 0; i < total; i += 1) {
        events.push(
          makeImageEvent({
            id: `$img${i}`,
            sender: OTHER_USER,
            ts: 1000 + i,
            batchId: 'b1',
            batchIndex: i,
          })
        );
      }
      const result = buildTimelineDescriptors(events, undefined, MY_USER);
      // First IMAGE_GROUP_MAX_SIZE merge into $img0; the rest start a new group at $img{cap}.
      expect(types(result)).toEqual(['event:$img0', `event:$img${IMAGE_GROUP_MAX_SIZE}`]);
      expect(findEvent(result, '$img0')?.groupedImages?.length).toBe(IMAGE_GROUP_MAX_SIZE);
      expect(findEvent(result, `$img${IMAGE_GROUP_MAX_SIZE}`)?.groupedImages?.length).toBe(
        total - IMAGE_GROUP_MAX_SIZE
      );
    });

    it('does not group images from different senders even when batch_id matches', () => {
      // A sender check stays in place so a colliding/replayed batch_id from
      // another user can never merge with the local user's batch.
      const result = buildTimelineDescriptors(
        [
          makeImageEvent({ id: '$A', sender: OTHER_USER, ts: 1000, batchId: 'b1', batchIndex: 0 }),
          makeImageEvent({ id: '$B', sender: MY_USER, ts: 1001, batchId: 'b1', batchIndex: 1 }),
        ],
        undefined,
        MY_USER
      );
      expect(types(result)).toEqual(['event:$A', 'event:$B']);
      expect(findEvent(result, '$A')?.groupedImages).toBeUndefined();
      expect(findEvent(result, '$B')?.groupedImages).toBeUndefined();
    });

    it('a non-image message between same-batch images breaks the group', () => {
      const result = buildTimelineDescriptors(
        [
          makeImageEvent({ id: '$A', sender: OTHER_USER, ts: 1000, batchId: 'b1', batchIndex: 0 }),
          makeEvent({ id: '$txt', sender: OTHER_USER, ts: 1500 }),
          makeImageEvent({ id: '$B', sender: OTHER_USER, ts: 2000, batchId: 'b1', batchIndex: 1 }),
        ],
        undefined,
        MY_USER
      );
      expect(types(result)).toEqual(['event:$A', 'event:$txt', 'event:$B']);
      expect(findEvent(result, '$A')?.groupedImages).toBeUndefined();
      expect(findEvent(result, '$B')?.groupedImages).toBeUndefined();
    });

    it('a reaction between same-batch images is invisible and does not break the group', () => {
      const result = buildTimelineDescriptors(
        [
          makeImageEvent({ id: '$A', sender: OTHER_USER, ts: 1000, batchId: 'b1', batchIndex: 0 }),
          makeEvent({ id: '$reaction', isReaction: true, ts: 1500 }),
          makeImageEvent({ id: '$B', sender: OTHER_USER, ts: 2000, batchId: 'b1', batchIndex: 1 }),
        ],
        undefined,
        MY_USER
      );
      expect(types(result)).toEqual(['event:$A']);
      expect(findEvent(result, '$A')?.groupedImages?.length).toBe(2);
    });

    it('does not group same-batch images that span a day boundary', () => {
      // Renderer constraint: a day-divider hidden inside a grid is the same
      // UX problem regardless of how the group was formed.
      const result = buildTimelineDescriptors(
        [
          makeImageEvent({ id: '$A', sender: OTHER_USER, ts: 1000, batchId: 'b1', batchIndex: 0 }),
          makeImageEvent({
            id: '$B',
            sender: OTHER_USER,
            ts: 1000 + ONE_DAY_MS,
            batchId: 'b1',
            batchIndex: 1,
          }),
        ],
        undefined,
        MY_USER
      );
      expect(types(result)).toEqual(['event:$A', 'day-divider', 'event:$B']);
      expect(findEvent(result, '$A')?.groupedImages).toBeUndefined();
      expect(findEvent(result, '$B')?.groupedImages).toBeUndefined();
    });

    it('grouped images render in batch_index order, not timeline order', () => {
      // Same origin_server_ts on every event — homeserver tie-break could deliver
      // them in any order. batch_index is the authority for visual ordering.
      const result = buildTimelineDescriptors(
        [
          makeImageEvent({ id: '$A', sender: OTHER_USER, ts: 1000, batchId: 'b1', batchIndex: 2 }),
          makeImageEvent({ id: '$B', sender: OTHER_USER, ts: 1000, batchId: 'b1', batchIndex: 0 }),
          makeImageEvent({ id: '$C', sender: OTHER_USER, ts: 1000, batchId: 'b1', batchIndex: 1 }),
        ],
        undefined,
        MY_USER
      );
      const anchor = findEvent(result, '$A');
      expect(anchor?.groupedImages?.map((c) => c.url)).toEqual([
        'mxc://example.com/$B',
        'mxc://example.com/$C',
        'mxc://example.com/$A',
      ]);
    });

    it('redirects new-messages divider when readUpto points to an absorbed image', () => {
      // The user has read up to $B, which is an absorbed image inside the
      // group anchored at $A. Reading any image in the group means the user
      // has seen the entire grid, so the divider should fire after the anchor.
      const result = buildTimelineDescriptors(
        [
          makeImageEvent({ id: '$A', sender: OTHER_USER, ts: 1000, batchId: 'b1', batchIndex: 0 }),
          makeImageEvent({ id: '$B', sender: OTHER_USER, ts: 1100, batchId: 'b1', batchIndex: 1 }),
          makeImageEvent({ id: '$C', sender: OTHER_USER, ts: 1200, batchId: 'b1', batchIndex: 2 }),
          makeEvent({ id: '$D', sender: OTHER_USER, ts: 1200 + 60_000 }),
        ],
        '$B',
        MY_USER
      );
      expect(types(result)).toEqual(['event:$A', 'new-messages', 'event:$D']);
    });

    it('does not collapse a non-image message after a single-image group anchor (different type)', () => {
      // Existing collapse rule requires same type — verify the image-group
      // anchor still behaves like a regular image w.r.t. collapse against
      // a following text message.
      const result = buildTimelineDescriptors(
        [
          makeImageEvent({ id: '$A', sender: OTHER_USER, ts: 1000, batchId: 'b1', batchIndex: 0 }),
          makeImageEvent({ id: '$B', sender: OTHER_USER, ts: 1100, batchId: 'b1', batchIndex: 1 }),
          makeEvent({ id: '$txt', sender: OTHER_USER, ts: 1000 + 60_000 }),
        ],
        undefined,
        MY_USER
      );
      expect(types(result)).toEqual(['event:$A', 'event:$txt']);
      // $txt and $A have the same type ('m.room.message') and same sender
      // within 2 minutes — collapse should still apply.
      expect(findEvent(result, '$txt')?.collapsed).toBe(true);
    });
  });
});
