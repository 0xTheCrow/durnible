import { describe, it, expect } from 'vitest';
import type { Mock } from 'vitest';
import type { MatrixEvent, Room } from 'matrix-js-sdk';
import { JoinRule, RestrictedAllowType } from 'matrix-js-sdk';
import { checkIsCallRoomEnterable, checkIsRoomCallAllowed } from './room-calls';
import type { RoomToParents } from '../../../types/matrix/room';
import { Membership, StateEvent } from '../../../types/matrix/room';
import { createMockMatrixEvent, createMockRoom } from '../../../test/mocks';

const ROOM_ID = '!room:example.com';
const SPACE_ID = '!space:example.com';

type StateEventsByType = {
  [StateEvent.SpaceParent]?: MatrixEvent[];
  [StateEvent.RoomJoinRules]?: MatrixEvent;
};

function createRoomWithState(stateEventsByType: StateEventsByType): Room {
  const room = createMockRoom(ROOM_ID);
  const state = (
    room as unknown as {
      getLiveTimeline: () => { getState: () => { getStateEvents: Mock } };
    }
  )
    .getLiveTimeline()
    .getState();

  state.getStateEvents.mockImplementation((eventType: StateEvent) => {
    if (eventType === StateEvent.SpaceParent) {
      return stateEventsByType[StateEvent.SpaceParent] ?? [];
    }
    if (eventType === StateEvent.RoomJoinRules) {
      return stateEventsByType[StateEvent.RoomJoinRules] ?? null;
    }
    return null;
  });

  return room as unknown as Room;
}

function createSpaceParentEvent(content: Record<string, unknown>): MatrixEvent {
  return createMockMatrixEvent({
    type: StateEvent.SpaceParent,
    stateKey: SPACE_ID,
    content,
  });
}

function createJoinRulesEvent(content: Record<string, unknown>): MatrixEvent {
  return createMockMatrixEvent({
    type: StateEvent.RoomJoinRules,
    stateKey: '',
    content,
  });
}

const noDirects = new Set<string>();
const noParents: RoomToParents = new Map();

describe('checkIsRoomCallAllowed', () => {
  it('allows a room with no space attachment of any kind', () => {
    const room = createRoomWithState({});

    expect(checkIsRoomCallAllowed(room, noDirects, noParents)).toBe(true);
  });

  it('blocks a room declaring m.space.parent even when the space is not joined', () => {
    const room = createRoomWithState({
      [StateEvent.SpaceParent]: [createSpaceParentEvent({ canonical: true, via: ['example.com'] })],
    });

    expect(checkIsRoomCallAllowed(room, noDirects, noParents)).toBe(false);
  });

  it('ignores an m.space.parent whose link has been removed', () => {
    const room = createRoomWithState({
      [StateEvent.SpaceParent]: [createSpaceParentEvent({})],
    });

    expect(checkIsRoomCallAllowed(room, noDirects, noParents)).toBe(true);
  });

  it('blocks a room known to be a space child through the joined-space map', () => {
    const room = createRoomWithState({});
    const roomToParents: RoomToParents = new Map([[ROOM_ID, new Set([SPACE_ID])]]);

    expect(checkIsRoomCallAllowed(room, noDirects, roomToParents)).toBe(false);
  });

  it('allows a direct message that is also a space child', () => {
    const room = createRoomWithState({
      [StateEvent.SpaceParent]: [createSpaceParentEvent({ canonical: true, via: ['example.com'] })],
    });
    const roomToParents: RoomToParents = new Map([[ROOM_ID, new Set([SPACE_ID])]]);

    expect(checkIsRoomCallAllowed(room, new Set([ROOM_ID]), roomToParents)).toBe(true);
  });

  it('blocks a room restricted to space membership', () => {
    const room = createRoomWithState({
      [StateEvent.RoomJoinRules]: createJoinRulesEvent({
        join_rule: JoinRule.Restricted,
        allow: [{ type: RestrictedAllowType.RoomMembership, room_id: SPACE_ID }],
      }),
    });

    expect(checkIsRoomCallAllowed(room, noDirects, noParents)).toBe(false);
  });

  it('blocks a knock_restricted room the same way as a restricted one', () => {
    const room = createRoomWithState({
      [StateEvent.RoomJoinRules]: createJoinRulesEvent({
        join_rule: 'knock_restricted',
        allow: [{ type: RestrictedAllowType.RoomMembership, room_id: SPACE_ID }],
      }),
    });

    expect(checkIsRoomCallAllowed(room, noDirects, noParents)).toBe(false);
  });

  it('allows a room whose allow list holds no space-membership entry', () => {
    const room = createRoomWithState({
      [StateEvent.RoomJoinRules]: createJoinRulesEvent({
        join_rule: JoinRule.Restricted,
        allow: [{ type: 'com.example.other', room_id: SPACE_ID }],
      }),
    });

    expect(checkIsRoomCallAllowed(room, noDirects, noParents)).toBe(true);
  });
});

describe('checkIsCallRoomEnterable', () => {
  it('lets joined and invited members in regardless of the join rule', () => {
    expect(
      checkIsCallRoomEnterable({
        membership: Membership.Join,
        joinRule: JoinRule.Invite,
        isParentSpaceMember: false,
      })
    ).toBe(true);

    expect(
      checkIsCallRoomEnterable({
        membership: Membership.Invite,
        joinRule: JoinRule.Invite,
        isParentSpaceMember: false,
      })
    ).toBe(true);
  });

  it('keeps a banned user out of a public room', () => {
    expect(
      checkIsCallRoomEnterable({
        membership: Membership.Ban,
        joinRule: JoinRule.Public,
        isParentSpaceMember: true,
      })
    ).toBe(false);
  });

  it('lets anyone into a public room without a membership', () => {
    expect(
      checkIsCallRoomEnterable({
        membership: undefined,
        joinRule: JoinRule.Public,
        isParentSpaceMember: false,
      })
    ).toBe(true);
  });

  it('gates a restricted room on parent space membership', () => {
    expect(
      checkIsCallRoomEnterable({
        membership: undefined,
        joinRule: JoinRule.Restricted,
        isParentSpaceMember: true,
      })
    ).toBe(true);

    expect(
      checkIsCallRoomEnterable({
        membership: undefined,
        joinRule: JoinRule.Restricted,
        isParentSpaceMember: false,
      })
    ).toBe(false);
  });

  it('treats knock_restricted the same as restricted', () => {
    expect(
      checkIsCallRoomEnterable({
        membership: undefined,
        joinRule: 'knock_restricted',
        isParentSpaceMember: true,
      })
    ).toBe(true);

    expect(
      checkIsCallRoomEnterable({
        membership: undefined,
        joinRule: 'knock_restricted',
        isParentSpaceMember: false,
      })
    ).toBe(false);
  });

  it('refuses join rules that do not grant entry', () => {
    const deniedRules = [JoinRule.Invite, JoinRule.Knock, undefined];

    deniedRules.forEach((joinRule) => {
      expect(
        checkIsCallRoomEnterable({
          membership: undefined,
          joinRule,
          isParentSpaceMember: true,
        })
      ).toBe(false);
    });
  });
});
