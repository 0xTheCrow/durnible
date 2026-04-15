import { describe, it, expect, vi } from 'vitest';
import type { IPushRule, MatrixEvent } from 'matrix-js-sdk';
import { RelationType } from 'matrix-js-sdk';
import {
  canEditEvent,
  findMutedRule,
  getAllParents,
  getLatestEdit,
  getMentionContent,
  getOrphanParents,
  isMutedRule,
  isNotificationEvent,
  isRoom,
  isSpace,
  isUnsupportedRoom,
  mapParentWithChildren,
  reactionOrEditEvent,
  trimReplyFromBody,
  trimReplyFromFormattedBody,
} from '../room';
import type { RoomToParents } from '../../../types/matrix/room';
import { MessageEvent, RoomType } from '../../../types/matrix/room';
import { createMockMatrixClient, createMockMatrixEvent, createMockRoom } from '../../../test/mocks';

// ─── Helpers ──────────────────────────────────────────────────────────────

function withRelation(event: MatrixEvent, relation: unknown): MatrixEvent {
  Object.defineProperty(event, 'getRelation', {
    value: vi.fn(() => relation),
    configurable: true,
  });
  return event;
}

function setRoomCreateState(
  room: ReturnType<typeof createMockRoom>,
  createEvent: MatrixEvent | null
): void {
  const state = (
    room as unknown as {
      getLiveTimeline: () => { getState: () => { getStateEvents: ReturnType<typeof vi.fn> } };
    }
  )
    .getLiveTimeline()
    .getState();
  state.getStateEvents.mockReturnValue(createEvent);
}

// ─── Reply formatting ─────────────────────────────────────────────────────

describe('trimReplyFromBody', () => {
  it('strips the quoted reply header and returns the remainder', () => {
    const body = '> <@alice:example.com> Hello\n> how are you\n\nActual reply text';
    expect(trimReplyFromBody(body)).toBe('Actual reply text');
  });

  it('returns the input unchanged when there is no reply header', () => {
    expect(trimReplyFromBody('Just a plain message')).toBe('Just a plain message');
  });
});

describe('trimReplyFromFormattedBody', () => {
  it('returns only the content after </mx-reply>', () => {
    const html = '<mx-reply><blockquote>quoted</blockquote></mx-reply>actual <em>reply</em>';
    expect(trimReplyFromFormattedBody(html)).toBe('actual <em>reply</em>');
  });

  it('slices after the LAST </mx-reply> when one is nested in the quote', () => {
    const html =
      '<mx-reply><blockquote>outer</blockquote></mx-reply>' +
      '<mx-reply><blockquote>inner</blockquote></mx-reply>reply body';
    expect(trimReplyFromFormattedBody(html)).toBe('reply body');
  });

  it('returns the input unchanged when there is no </mx-reply>', () => {
    expect(trimReplyFromFormattedBody('<p>plain</p>')).toBe('<p>plain</p>');
  });
});

// ─── Space hierarchy ──────────────────────────────────────────────────────

describe('getAllParents', () => {
  it('returns an empty set when the room has no parents', () => {
    const map: RoomToParents = new Map();
    expect(getAllParents(map, '!a:ex')).toEqual(new Set());
  });

  it('returns direct and transitive parents, excluding the starting room itself', () => {
    const map: RoomToParents = new Map([
      ['!child:ex', new Set(['!parent:ex'])],
      ['!parent:ex', new Set(['!grand:ex'])],
    ]);
    expect(getAllParents(map, '!child:ex')).toEqual(new Set(['!parent:ex', '!grand:ex']));
  });

  it('does not infinite-loop on a parent cycle', () => {
    const map: RoomToParents = new Map([
      ['!a:ex', new Set(['!b:ex'])],
      ['!b:ex', new Set(['!a:ex'])],
    ]);
    expect(getAllParents(map, '!a:ex')).toEqual(new Set(['!b:ex']));
  });
});

describe('getOrphanParents', () => {
  it('returns only the ancestors that have no parents of their own', () => {
    const map: RoomToParents = new Map([
      ['!child:ex', new Set(['!mid:ex'])],
      ['!mid:ex', new Set(['!top:ex'])],
    ]);
    expect(getOrphanParents(map, '!child:ex')).toEqual(['!top:ex']);
  });

  it('returns every ancestor when none of them have parents', () => {
    const map: RoomToParents = new Map([['!child:ex', new Set(['!a:ex', '!b:ex'])]]);
    expect(getOrphanParents(map, '!child:ex').sort()).toEqual(['!a:ex', '!b:ex']);
  });
});

describe('mapParentWithChildren', () => {
  it('registers the parent for every child in the list', () => {
    const map: RoomToParents = new Map();
    mapParentWithChildren(map, '!parent:ex', ['!c1:ex', '!c2:ex']);
    expect(map.get('!c1:ex')).toEqual(new Set(['!parent:ex']));
    expect(map.get('!c2:ex')).toEqual(new Set(['!parent:ex']));
  });

  it('appends to the existing parent set for a child that already has parents', () => {
    const map: RoomToParents = new Map([['!child:ex', new Set(['!p1:ex'])]]);
    mapParentWithChildren(map, '!p2:ex', ['!child:ex']);
    expect(map.get('!child:ex')).toEqual(new Set(['!p1:ex', '!p2:ex']));
  });

  it('skips a child that would create a space cycle', () => {
    // !parent has ancestor !child already, so adding !child as a child of !parent is a cycle.
    const map: RoomToParents = new Map([['!parent:ex', new Set(['!child:ex'])]]);
    mapParentWithChildren(map, '!parent:ex', ['!child:ex']);
    // !child must not have gained !parent as an ancestor
    expect(map.get('!child:ex')).toBeUndefined();
  });
});

// ─── Muted push rules ─────────────────────────────────────────────────────

const mutedRule = {
  rule_id: '!room:ex',
  actions: ['dont_notify'],
  conditions: [{ kind: 'event_match' }],
} as unknown as IPushRule;

describe('isMutedRule', () => {
  it('returns true for a dont_notify rule with an event_match condition', () => {
    expect(isMutedRule(mutedRule)).toBe(true);
  });

  it('returns false when the first action is not dont_notify', () => {
    const rule = { ...mutedRule, actions: ['notify'] } as unknown as IPushRule;
    expect(isMutedRule(rule)).toBe(false);
  });

  it('returns false when the first condition is not event_match', () => {
    const rule = {
      ...mutedRule,
      conditions: [{ kind: 'contains_display_name' }],
    } as unknown as IPushRule;
    expect(isMutedRule(rule)).toBe(false);
  });
});

describe('findMutedRule', () => {
  it('finds a muted rule whose rule_id matches the room id', () => {
    expect(findMutedRule([mutedRule], '!room:ex')).toBe(mutedRule);
  });

  it('returns undefined when no rule matches the room id', () => {
    expect(findMutedRule([mutedRule], '!other:ex')).toBeUndefined();
  });
});

// ─── Mention content ──────────────────────────────────────────────────────

describe('getMentionContent', () => {
  it('returns an empty object when there are no user mentions and no room mention', () => {
    expect(getMentionContent([], false)).toEqual({});
  });

  it('includes user_ids only when the list is non-empty', () => {
    expect(getMentionContent(['@alice:ex'], false)).toEqual({ user_ids: ['@alice:ex'] });
  });

  it('sets room: true when the room flag is on, alongside user_ids', () => {
    expect(getMentionContent(['@alice:ex'], true)).toEqual({
      user_ids: ['@alice:ex'],
      room: true,
    });
  });
});

// ─── Notification event filter ────────────────────────────────────────────

describe('isNotificationEvent', () => {
  function messageEvent() {
    return withRelation(
      createMockMatrixEvent({ type: 'm.room.message', content: { body: 'hi', msgtype: 'm.text' } }),
      null
    );
  }

  it('returns true for a regular m.room.message', () => {
    expect(isNotificationEvent(messageEvent())).toBe(true);
  });

  it('returns true for a sticker event', () => {
    expect(
      isNotificationEvent(withRelation(createMockMatrixEvent({ type: 'm.sticker' }), null))
    ).toBe(true);
  });

  it('returns false for an m.room.member event (explicit exclusion)', () => {
    expect(
      isNotificationEvent(withRelation(createMockMatrixEvent({ type: 'm.room.member' }), null))
    ).toBe(false);
  });

  it('returns false for event types outside the notification allowlist', () => {
    expect(
      isNotificationEvent(withRelation(createMockMatrixEvent({ type: 'm.room.topic' }), null))
    ).toBe(false);
  });

  it('returns false for a redacted message', () => {
    expect(
      isNotificationEvent(
        withRelation(createMockMatrixEvent({ type: 'm.room.message', redacted: true }), null)
      )
    ).toBe(false);
  });

  it('returns false for an edit (m.replace relation)', () => {
    expect(
      isNotificationEvent(
        withRelation(createMockMatrixEvent({ type: 'm.room.message' }), { rel_type: 'm.replace' })
      )
    ).toBe(false);
  });
});

// ─── Edit predicates ──────────────────────────────────────────────────────

describe('canEditEvent', () => {
  const me = '@me:example.com';

  function myTextMessage(overrides: { content?: Record<string, unknown> } = {}) {
    return createMockMatrixEvent({
      sender: me,
      type: MessageEvent.RoomMessage,
      content: { body: 'hi', msgtype: 'm.text', ...(overrides.content ?? {}) },
    });
  }

  it("returns true for the user's own m.text message", () => {
    const mx = createMockMatrixClient();
    expect(canEditEvent(mx as never, myTextMessage())).toBe(true);
  });

  it("returns true for the user's own m.emote", () => {
    const mx = createMockMatrixClient();
    expect(canEditEvent(mx as never, myTextMessage({ content: { msgtype: 'm.emote' } }))).toBe(
      true
    );
  });

  it('returns false when the sender is someone else', () => {
    const mx = createMockMatrixClient();
    const evt = createMockMatrixEvent({
      sender: '@other:example.com',
      type: MessageEvent.RoomMessage,
      content: { body: 'hi', msgtype: 'm.text' },
    });
    expect(canEditEvent(mx as never, evt)).toBe(false);
  });

  it('returns false for an image message (wrong msgtype)', () => {
    const mx = createMockMatrixClient();
    expect(canEditEvent(mx as never, myTextMessage({ content: { msgtype: 'm.image' } }))).toBe(
      false
    );
  });

  it('returns false when the event already has an m.replace relation', () => {
    const mx = createMockMatrixClient();
    const evt = myTextMessage({
      content: { 'm.relates_to': { rel_type: RelationType.Replace, event_id: '$x' } },
    });
    expect(canEditEvent(mx as never, evt)).toBe(false);
  });

  it('returns true for a thread-relation message (thread relations are allowed)', () => {
    const mx = createMockMatrixClient();
    const evt = myTextMessage({
      content: { 'm.relates_to': { rel_type: RelationType.Thread, event_id: '$root' } },
    });
    expect(canEditEvent(mx as never, evt)).toBe(true);
  });
});

// ─── Reaction / edit / poll detector ──────────────────────────────────────

describe('reactionOrEditEvent', () => {
  it('returns true for an annotation (reaction)', () => {
    const evt = withRelation(createMockMatrixEvent({ type: 'm.reaction' }), {
      rel_type: RelationType.Annotation,
    });
    expect(reactionOrEditEvent(evt)).toBe(true);
  });

  it('returns true for a replace (edit)', () => {
    const evt = withRelation(createMockMatrixEvent({ type: 'm.room.message' }), {
      rel_type: RelationType.Replace,
    });
    expect(reactionOrEditEvent(evt)).toBe(true);
  });

  it('returns true for a poll response via a reference relation', () => {
    const evt = withRelation(createMockMatrixEvent({ type: MessageEvent.PollResponse }), {
      rel_type: RelationType.Reference,
    });
    expect(reactionOrEditEvent(evt)).toBe(true);
  });

  it('returns true for a stable m.poll.end event via a reference relation', () => {
    const evt = withRelation(createMockMatrixEvent({ type: 'm.poll.end' }), {
      rel_type: RelationType.Reference,
    });
    expect(reactionOrEditEvent(evt)).toBe(true);
  });

  it('returns false for a reference relation on a non-poll event type', () => {
    const evt = withRelation(createMockMatrixEvent({ type: 'm.room.message' }), {
      rel_type: RelationType.Reference,
    });
    expect(reactionOrEditEvent(evt)).toBe(false);
  });

  it('returns false when there is no relation at all', () => {
    const evt = withRelation(createMockMatrixEvent({ type: 'm.room.message' }), null);
    expect(reactionOrEditEvent(evt)).toBe(false);
  });
});

// ─── Latest edit selection ────────────────────────────────────────────────

describe('getLatestEdit', () => {
  function editBy(sender: string, ts: number): MatrixEvent {
    return createMockMatrixEvent({
      id: `$edit-${sender}-${ts}`,
      sender,
      ts,
      type: MessageEvent.RoomMessage,
    });
  }

  it('returns the newest edit whose sender matches the target event', () => {
    const target = createMockMatrixEvent({ sender: '@alice:ex' });
    const edits = [editBy('@alice:ex', 100), editBy('@alice:ex', 200), editBy('@alice:ex', 150)];
    expect(getLatestEdit(target, edits)?.getId()).toBe('$edit-@alice:ex-200');
  });

  it('ignores edits sent by anyone other than the original sender', () => {
    const target = createMockMatrixEvent({ sender: '@alice:ex' });
    const edits = [editBy('@mallory:ex', 999), editBy('@alice:ex', 100)];
    expect(getLatestEdit(target, edits)?.getId()).toBe('$edit-@alice:ex-100');
  });

  it('returns undefined when no edit is from the original sender', () => {
    const target = createMockMatrixEvent({ sender: '@alice:ex' });
    const edits = [editBy('@bob:ex', 100), editBy('@carol:ex', 200)];
    expect(getLatestEdit(target, edits)).toBeUndefined();
  });
});

// ─── Room-type predicates ─────────────────────────────────────────────────

describe('isSpace / isRoom / isUnsupportedRoom', () => {
  function roomWithCreateType(type: string | undefined) {
    const room = createMockRoom('!r:ex');
    const createEvent =
      type === undefined
        ? createMockMatrixEvent({ type: 'm.room.create', content: {} })
        : createMockMatrixEvent({ type: 'm.room.create', content: { type } });
    setRoomCreateState(room, createEvent);
    return room;
  }

  it('isSpace returns true only for m.room.create.type === "m.space"', () => {
    expect(isSpace(roomWithCreateType(RoomType.Space) as never)).toBe(true);
    expect(isSpace(roomWithCreateType(undefined) as never)).toBe(false);
    expect(isSpace(null)).toBe(false);
  });

  it('isRoom returns true for a regular room and false for a space', () => {
    expect(isRoom(roomWithCreateType(undefined) as never)).toBe(true);
    expect(isRoom(roomWithCreateType(RoomType.Space) as never)).toBe(false);
  });

  it('isRoom returns true when the m.room.create event is missing entirely', () => {
    const room = createMockRoom('!r:ex');
    setRoomCreateState(room, null);
    expect(isRoom(room as never)).toBe(true);
  });

  it('isUnsupportedRoom returns true for an m.room.create with an unknown type', () => {
    expect(isUnsupportedRoom(roomWithCreateType('com.example.custom') as never)).toBe(true);
  });

  it('isUnsupportedRoom returns false for a plain room', () => {
    expect(isUnsupportedRoom(roomWithCreateType(undefined) as never)).toBe(false);
  });

  it('isUnsupportedRoom returns false for a space', () => {
    expect(isUnsupportedRoom(roomWithCreateType(RoomType.Space) as never)).toBe(false);
  });
});
