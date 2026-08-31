import { describe, expect, it } from 'vitest';
import { getRoomPathWithoutEventId } from './lastVisitedRoomPath';

describe('getRoomPathWithoutEventId', () => {
  it('returns the room path for every nav', () => {
    expect(getRoomPathWithoutEventId('/home/!room%3Aserver.com')).toBe('/home/!room%3Aserver.com');
    expect(getRoomPathWithoutEventId('/direct/!room%3Aserver.com')).toBe(
      '/direct/!room%3Aserver.com'
    );
    expect(getRoomPathWithoutEventId('/!space%3Aserver.com/!room%3Aserver.com')).toBe(
      '/!space%3Aserver.com/!room%3Aserver.com'
    );
    expect(getRoomPathWithoutEventId('/home/%23room%3Aserver.com')).toBe(
      '/home/%23room%3Aserver.com'
    );
  });

  it('drops the event id', () => {
    expect(getRoomPathWithoutEventId('/home/!room%3Aserver.com/%24event')).toBe(
      '/home/!room%3Aserver.com'
    );
    expect(getRoomPathWithoutEventId('/!space%3Aserver.com/!room%3Aserver.com/%24event')).toBe(
      '/!space%3Aserver.com/!room%3Aserver.com'
    );
  });

  it('encodes an unencoded room path', () => {
    expect(getRoomPathWithoutEventId('/home/!room:server.com/')).toBe('/home/!room%3Aserver.com');
  });

  it('ignores paths whose segments are not room ids', () => {
    expect(getRoomPathWithoutEventId('/home/create/')).toBeUndefined();
    expect(getRoomPathWithoutEventId('/direct/create/')).toBeUndefined();
    expect(getRoomPathWithoutEventId('/explore/featured/')).toBeUndefined();
    expect(getRoomPathWithoutEventId('/inbox/notifications/')).toBeUndefined();
    expect(getRoomPathWithoutEventId('/!space%3Aserver.com/lobby')).toBeUndefined();
  });
});
