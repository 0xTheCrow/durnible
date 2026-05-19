import { describe, it, expect } from 'vitest';
import { isServerName, getMxIdServer, getMxIdLocalPart, isUserId, isRoomAlias } from './matrix';

describe('isServerName', () => {
  it('accepts standard domain names', () => {
    expect(isServerName('matrix.org')).toBe(true);
    expect(isServerName('example.com')).toBe(true);
    expect(isServerName('sub.domain.co.uk')).toBe(true);
  });

  it('rejects bare hostnames and empty strings', () => {
    expect(isServerName('localhost')).toBe(false);
    expect(isServerName('')).toBe(false);
  });
});

describe('getMxIdServer', () => {
  it('returns the server part of a valid matrix ID', () => {
    expect(getMxIdServer('@alice:example.com')).toBe('example.com');
    expect(getMxIdServer('#room:matrix.org')).toBe('matrix.org');
    expect(getMxIdServer('$event:server.net')).toBe('server.net');
  });

  it('returns undefined for invalid IDs', () => {
    expect(getMxIdServer('notanid')).toBeUndefined();
    expect(getMxIdServer('@alice')).toBeUndefined();
    expect(getMxIdServer('')).toBeUndefined();
  });
});

describe('getMxIdLocalPart', () => {
  it('returns the localpart of a valid matrix ID', () => {
    expect(getMxIdLocalPart('@alice:example.com')).toBe('alice');
    expect(getMxIdLocalPart('#general:matrix.org')).toBe('general');
    expect(getMxIdLocalPart('@user.name:server.com')).toBe('user.name');
  });

  it('returns undefined for invalid IDs', () => {
    expect(getMxIdLocalPart('notanid')).toBeUndefined();
    expect(getMxIdLocalPart('')).toBeUndefined();
  });
});

describe('isUserId', () => {
  it('accepts valid user IDs', () => {
    expect(isUserId('@alice:example.com')).toBe(true);
    expect(isUserId('@user.name:matrix.org')).toBe(true);
    expect(isUserId('@_bot:server.net')).toBe(true);
  });

  it('rejects wrong sigil or missing server', () => {
    expect(isUserId('#room:example.com')).toBe(false);
    expect(isUserId('!room:example.com')).toBe(false);
    expect(isUserId('@alice')).toBe(false);
    expect(isUserId('')).toBe(false);
  });

  it('rejects IDs with spaces in the localpart', () => {
    expect(isUserId('@alice bob:example.com')).toBe(false);
  });
});

describe('isRoomAlias', () => {
  it('accepts valid room aliases', () => {
    expect(isRoomAlias('#general:matrix.org')).toBe(true);
    expect(isRoomAlias('#my-room:example.com')).toBe(true);
  });

  it('rejects non-alias IDs', () => {
    expect(isRoomAlias('@user:example.com')).toBe(false);
    expect(isRoomAlias('!room:example.com')).toBe(false);
    expect(isRoomAlias('#room')).toBe(false);
    expect(isRoomAlias('')).toBe(false);
  });
});
