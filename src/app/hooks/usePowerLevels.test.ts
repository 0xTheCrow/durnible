import { describe, it, expect } from 'vitest';
import type { PowerLevels } from './usePowerLevels';
import {
  DEFAULT_POWER_LEVELS,
  fillMissingPowers,
  getPermissionPower,
  applyPermissionPower,
} from './usePowerLevels';

describe('fillMissingPowers', () => {
  it('fills all missing fields with defaults', () => {
    const result = fillMissingPowers({});
    expect(result).toEqual(DEFAULT_POWER_LEVELS);
  });

  it('preserves explicit values including zero', () => {
    const result = fillMissingPowers({ ban: 0, invite: 25 });
    expect(result.ban).toBe(0);
    expect(result.invite).toBe(25);
    expect(result.kick).toBe(DEFAULT_POWER_LEVELS.kick);
    expect(result.users_default).toBe(DEFAULT_POWER_LEVELS.users_default);
  });

  it('fills missing notifications.room', () => {
    const result = fillMissingPowers({ notifications: {} });
    expect(result.notifications?.room).toBe(DEFAULT_POWER_LEVELS.notifications.room);
  });
});

describe('getPermissionPower', () => {
  const pl: PowerLevels = {
    ...DEFAULT_POWER_LEVELS,
    users: { '@alice:example.com': 50 },
    users_default: 0,
    ban: 75,
    events: { 'm.room.message': 10, 'm.room.name': 60 },
    state_default: 50,
    notifications: { room: 30 },
  };

  it('reads user power by userId', () => {
    expect(getPermissionPower(pl, { user: true, key: '@alice:example.com' })).toBe(50);
  });

  it('falls back to users_default for unknown user', () => {
    expect(getPermissionPower(pl, { user: true, key: '@bob:example.com' })).toBe(pl.users_default);
  });

  it('reads action power', () => {
    expect(getPermissionPower(pl, { action: true, key: 'ban' })).toBe(75);
  });

  it('reads event power', () => {
    expect(getPermissionPower(pl, { key: 'm.room.message' })).toBe(10);
  });

  it('reads state power', () => {
    expect(getPermissionPower(pl, { state: true, key: 'm.room.name' })).toBe(60);
  });

  it('falls back to state_default for unknown state event', () => {
    expect(getPermissionPower(pl, { state: true })).toBe(pl.state_default);
  });

  it('reads notification power', () => {
    expect(getPermissionPower(pl, { notification: true, key: 'room' })).toBe(30);
  });
});

describe('applyPermissionPower', () => {
  it('sets user power', () => {
    const pl: PowerLevels = { ...DEFAULT_POWER_LEVELS };
    const result = applyPermissionPower(pl, { user: true, key: '@alice:example.com' }, 100);
    expect(result.users?.['@alice:example.com']).toBe(100);
  });

  it('sets users_default', () => {
    const pl: PowerLevels = { ...DEFAULT_POWER_LEVELS };
    const result = applyPermissionPower(pl, { user: true }, 10);
    expect(result.users_default).toBe(10);
  });

  it('sets action power', () => {
    const pl: PowerLevels = { ...DEFAULT_POWER_LEVELS };
    const result = applyPermissionPower(pl, { action: true, key: 'ban' }, 75);
    expect(result.ban).toBe(75);
  });

  it('sets event power', () => {
    const pl: PowerLevels = { ...DEFAULT_POWER_LEVELS };
    const result = applyPermissionPower(pl, { key: 'm.room.message' }, 25);
    expect(result.events?.['m.room.message']).toBe(25);
  });

  it('sets notification power', () => {
    const pl: PowerLevels = { ...DEFAULT_POWER_LEVELS };
    const result = applyPermissionPower(pl, { notification: true, key: 'room' }, 80);
    expect(result.notifications?.room).toBe(80);
  });

  it('does not mutate the input', () => {
    const pl: PowerLevels = {
      ...DEFAULT_POWER_LEVELS,
      users: { '@alice:example.com': 50 },
      events: { 'm.room.message': 0 },
    };
    const original = JSON.parse(JSON.stringify(pl));
    applyPermissionPower(pl, { user: true, key: '@bob:example.com' }, 100);
    applyPermissionPower(pl, { action: true, key: 'ban' }, 99);
    applyPermissionPower(pl, { key: 'm.room.topic' }, 50);
    expect(pl).toEqual(original);
  });
});
