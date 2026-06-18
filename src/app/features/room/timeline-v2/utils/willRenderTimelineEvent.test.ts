import { describe, it, expect } from 'vitest';
import type { MatrixEvent } from 'matrix-js-sdk';
import { RelationType } from 'matrix-js-sdk';
import { willRenderTimelineEvent } from './willRenderTimelineEvent';
import type { WillRenderTimelineEventOptions } from './willRenderTimelineEvent';

type EventOverrides = {
  sender?: string;
  type?: string;
  relationType?: string;
  redacted?: boolean;
};

const makeEvent = (overrides: EventOverrides = {}): MatrixEvent =>
  ({
    getId: () => '$event',
    getSender: () => overrides.sender ?? '@alice:example.com',
    getType: () => overrides.type ?? 'm.room.message',
    getStateKey: () => undefined,
    getRelation: () => (overrides.relationType ? { rel_type: overrides.relationType } : null),
    isRedaction: () => false,
    isRedacted: () => overrides.redacted ?? false,
  } as unknown as MatrixEvent);

const options = (
  overrides: Partial<WillRenderTimelineEventOptions> = {}
): WillRenderTimelineEventOptions => ({
  ignoredUsersSet: new Set(),
  showHiddenEvents: false,
  hideMembershipEvents: false,
  hideNickAvatarEvents: false,
  ...overrides,
});

describe('willRenderTimelineEvent', () => {
  it('excludes events from an ignored sender', () => {
    const result = willRenderTimelineEvent(
      makeEvent({ sender: '@blocked:example.com' }),
      options({ ignoredUsersSet: new Set(['@blocked:example.com']), showHiddenEvents: true })
    );
    expect(result).toBe(false);
  });

  it('excludes a redacted message when hidden events are off', () => {
    const result = willRenderTimelineEvent(
      makeEvent({ redacted: true }),
      options({ showHiddenEvents: false })
    );
    expect(result).toBe(false);
  });

  it('keeps a redacted message when hidden events are on', () => {
    const result = willRenderTimelineEvent(
      makeEvent({ redacted: true }),
      options({ showHiddenEvents: true })
    );
    expect(result).toBe(true);
  });

  it('renders a normal message that is neither ignored nor redacted', () => {
    expect(willRenderTimelineEvent(makeEvent(), options())).toBe(true);
  });

  it('delegates the per-type decision to willEventRender (unregistered type hidden)', () => {
    const result = willRenderTimelineEvent(
      makeEvent({ type: 'm.room.power_levels' }),
      options({ showHiddenEvents: false })
    );
    expect(result).toBe(false);
  });

  it('does not treat an annotation relation as renderable', () => {
    const result = willRenderTimelineEvent(
      makeEvent({ relationType: RelationType.Annotation }),
      options()
    );
    expect(result).toBe(false);
  });
});
