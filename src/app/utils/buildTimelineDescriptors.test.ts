import { RelationType } from 'matrix-js-sdk';
import { describe, it, expect, vi } from 'vitest';
import { buildTimelineDescriptors, TimelineEventInput, TimelineItem } from './buildTimelineDescriptors';
import { createMockMatrixEvent } from '../../test/mocks';

const MY_USER = '@me:example.com';
const OTHER_USER = '@alice:example.com';

const FAKE_TIMELINE_SET = {} as any;

// One day in milliseconds, used to force day-divider insertion.
const ONE_DAY_MS = 24 * 60 * 60 * 1000;

function makeEvent(opts: {
  id: string;
  sender?: string;
  ts?: number;
  type?: string;
  isReaction?: boolean;
}): TimelineEventInput {
  const base = createMockMatrixEvent({
    id: opts.id,
    sender: opts.sender ?? OTHER_USER,
    ts: opts.ts ?? 1000,
    type: opts.type ?? 'm.room.message',
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
        makeEvent({ id: '$B', sender: MY_USER }),   // own — no divider yet
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
      [
        makeEvent({ id: '$A' }),
        makeEvent({ id: '$reaction', isReaction: true }),
      ],
      '$A',
      MY_USER
    );
    expect(types(result)).toEqual(['event:$A']);
  });

  // ─── Day divider ─────────────────────────────────────────────────────────────

  it('inserts day-divider when consecutive messages cross midnight', () => {
    const result = buildTimelineDescriptors(
      [
        makeEvent({ id: '$A', ts: 1000 }),
        makeEvent({ id: '$B', ts: 1000 + ONE_DAY_MS }),
      ],
      undefined,
      MY_USER
    );
    expect(types(result)).toEqual(['event:$A', 'day-divider', 'event:$B']);
    const divider = result.find((d) => d.type === 'day-divider') as Extract<TimelineItem, { type: 'day-divider' }>;
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
    const divider = result.find((d) => d.type === 'day-divider') as Extract<TimelineItem, { type: 'day-divider' }>;
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
    const eventB = result.find((d) => d.type === 'event' && d.mEventId === '$B') as Extract<TimelineItem, { type: 'event' }>;
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
    const eventB = result.find((d) => d.type === 'event' && d.mEventId === '$B') as Extract<TimelineItem, { type: 'event' }>;
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
        makeEvent({ id: '$B', ts: laterTs }),         // suppressed (e.g. m.room.redaction)
        makeEvent({ id: '$C', ts: laterTs + 1 }),     // visible
      ],
      undefined,
      MY_USER,
      (mEvent) => !suppress.has(mEvent.getId() ?? '')
    );
    expect(types(result)).toEqual(['event:$A', 'day-divider', 'event:$C']);
    const divider = result.find((d) => d.type === 'day-divider') as Extract<TimelineItem, { type: 'day-divider' }>;
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
      [
        makeEvent({ id: '$A', ts: 1000 }),
        makeEvent({ id: '$B', ts: 1000 + ONE_DAY_MS }),
      ],
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
    expect(types(result)).toEqual(['event:$A', 'day-divider', 'event:$B', 'day-divider', 'event:$C']);
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
    const eventB = result.find((d) => d.type === 'event' && d.mEventId === '$B') as Extract<TimelineItem, { type: 'event' }>;
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
    const eventB = result.find((d) => d.type === 'event' && d.mEventId === '$B') as Extract<TimelineItem, { type: 'event' }>;
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
    const eventB = result.find((d) => d.type === 'event' && d.mEventId === '$B') as Extract<TimelineItem, { type: 'event' }>;
    expect(eventB?.collapsed).toBe(false);
  });
});
