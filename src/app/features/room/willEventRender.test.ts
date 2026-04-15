import { describe, it, expect, vi } from 'vitest';
import type { MatrixEvent } from 'matrix-js-sdk';
import { RelationType } from 'matrix-js-sdk';
import { willEventRender } from './willEventRender';
import { createMockMatrixEvent } from '../../../test/mocks';

const DEFAULT_SETTINGS = {
  showHiddenEvents: false,
  hideMembershipEvents: false,
  hideNickAvatarEvents: false,
};

function withRelation(event: MatrixEvent, relation: unknown): MatrixEvent {
  Object.defineProperty(event, 'getRelation', {
    value: vi.fn(() => relation),
    configurable: true,
  });
  // createMockMatrixEvent doesn't include isRedaction; default it to false here.
  Object.defineProperty(event, 'isRedaction', {
    value: vi.fn(() => false),
    configurable: true,
  });
  return event;
}

function withRedaction(event: MatrixEvent): MatrixEvent {
  Object.defineProperty(event, 'isRedaction', {
    value: vi.fn(() => true),
    configurable: true,
  });
  return event;
}

function roomMessage() {
  return withRelation(
    createMockMatrixEvent({ type: 'm.room.message', content: { body: 'hi', msgtype: 'm.text' } }),
    null
  );
}

function memberEvent(opts: { membershipChanged: boolean }) {
  const content = opts.membershipChanged
    ? { membership: 'join' }
    : { membership: 'join', displayname: 'new-name' };
  const prevContent = opts.membershipChanged
    ? { membership: 'leave' }
    : { membership: 'join', displayname: 'old-name' };
  const event = withRelation(
    createMockMatrixEvent({ type: 'm.room.member', stateKey: '@alice:ex', content }),
    null
  );
  (event as unknown as { getPrevContent: () => unknown }).getPrevContent = vi.fn(() => prevContent);
  return event;
}

// ─── Reaction / edit filtering ────────────────────────────────────────────

describe('willEventRender — reaction / edit filtering', () => {
  it('returns false for an annotation (reaction) even with showHiddenEvents on', () => {
    const evt = withRelation(createMockMatrixEvent({ type: 'm.reaction' }), {
      rel_type: RelationType.Annotation,
    });
    expect(willEventRender(evt, { ...DEFAULT_SETTINGS, showHiddenEvents: true })).toBe(false);
  });

  it('returns false for an edit (m.replace relation)', () => {
    const evt = withRelation(createMockMatrixEvent({ type: 'm.room.message' }), {
      rel_type: RelationType.Replace,
    });
    expect(willEventRender(evt, DEFAULT_SETTINGS)).toBe(false);
  });
});

// ─── Redaction gating ─────────────────────────────────────────────────────

describe('willEventRender — redaction gating', () => {
  it('returns false for a redaction event when showHiddenEvents is off', () => {
    const evt = withRedaction(
      withRelation(createMockMatrixEvent({ type: 'm.room.redaction' }), null)
    );
    expect(willEventRender(evt, DEFAULT_SETTINGS)).toBe(false);
  });

  it('returns true for a redaction event when showHiddenEvents is on', () => {
    const evt = withRedaction(
      withRelation(createMockMatrixEvent({ type: 'm.room.redaction' }), null)
    );
    expect(willEventRender(evt, { ...DEFAULT_SETTINGS, showHiddenEvents: true })).toBe(true);
  });
});

// ─── Event type allowlist ─────────────────────────────────────────────────

describe('willEventRender — event type allowlist', () => {
  it('returns true for a regular m.room.message with default settings', () => {
    expect(willEventRender(roomMessage(), DEFAULT_SETTINGS)).toBe(true);
  });

  it('returns false for a non-allowlisted type (e.g. m.room.power_levels) when showHiddenEvents is off', () => {
    const evt = withRelation(createMockMatrixEvent({ type: 'm.room.power_levels' }), null);
    expect(willEventRender(evt, DEFAULT_SETTINGS)).toBe(false);
  });

  it('returns true for a non-allowlisted type when showHiddenEvents is on', () => {
    const evt = withRelation(createMockMatrixEvent({ type: 'm.room.power_levels' }), null);
    expect(willEventRender(evt, { ...DEFAULT_SETTINGS, showHiddenEvents: true })).toBe(true);
  });

  it('returns true for stable poll-start event type m.poll.start', () => {
    const evt = withRelation(createMockMatrixEvent({ type: 'm.poll.start' }), null);
    expect(willEventRender(evt, DEFAULT_SETTINGS)).toBe(true);
  });
});

// ─── Membership / nick+avatar filtering ───────────────────────────────────

describe('willEventRender — member event filtering', () => {
  it('returns true for a membership change by default', () => {
    expect(willEventRender(memberEvent({ membershipChanged: true }), DEFAULT_SETTINGS)).toBe(true);
  });

  it('returns false for a membership change when hideMembershipEvents is on', () => {
    expect(
      willEventRender(memberEvent({ membershipChanged: true }), {
        ...DEFAULT_SETTINGS,
        hideMembershipEvents: true,
      })
    ).toBe(false);
  });

  it('returns true for a nick/avatar change by default', () => {
    expect(willEventRender(memberEvent({ membershipChanged: false }), DEFAULT_SETTINGS)).toBe(true);
  });

  it('returns false for a nick/avatar change when hideNickAvatarEvents is on', () => {
    expect(
      willEventRender(memberEvent({ membershipChanged: false }), {
        ...DEFAULT_SETTINGS,
        hideNickAvatarEvents: true,
      })
    ).toBe(false);
  });

  it('still hides a nick/avatar change when hideMembershipEvents alone is set (they are independent flags)', () => {
    expect(
      willEventRender(memberEvent({ membershipChanged: false }), {
        ...DEFAULT_SETTINGS,
        hideMembershipEvents: true,
      })
    ).toBe(true);
  });
});
