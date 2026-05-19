import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createStore } from 'jotai';
import type { Room } from 'matrix-js-sdk';
import { ImagePack, PackAddress, type PackContent } from '../plugins/custom-emoji';
import { portableImagePacksAtom } from './portableImagePacks';

const { getRoomImagePacksMock } = vi.hoisted(() => ({
  getRoomImagePacksMock: vi.fn<(room: Room) => ImagePack[]>(() => []),
}));

vi.mock('../plugins/custom-emoji', async () => {
  const actual = (await vi.importActual('../plugins/custom-emoji')) as object;
  return {
    ...actual,
    getRoomImagePacks: getRoomImagePacksMock,
  };
});

const makePack = (
  roomId: string,
  stateKey: string,
  shortcode: string,
  portable: boolean
): ImagePack => {
  const content: PackContent = {
    pack: {
      display_name: `${roomId}-${stateKey}`,
      portable,
    },
    images: {
      [shortcode]: { url: `mxc://example/${shortcode}` },
    },
  };
  return new ImagePack(`${roomId}:${stateKey}`, content, new PackAddress(roomId, stateKey));
};

const makeRoomMock = (roomId: string): Room => ({ roomId } as unknown as Room);

describe('portableImagePacksAtom', () => {
  beforeEach(() => {
    getRoomImagePacksMock.mockReset();
    getRoomImagePacksMock.mockReturnValue([]);
  });

  it('INITIALIZE replaces the map', () => {
    const store = createStore();
    const pack = makePack('!a:server', 'pack1', 'wave', true);
    const map = new Map([[`!a:server:pack1`, pack]]);

    store.set(portableImagePacksAtom, { type: 'INITIALIZE', map });
    expect(store.get(portableImagePacksAtom)).toBe(map);
  });

  it('UPSERT with a portable pack adds it', () => {
    const store = createStore();
    const pack = makePack('!a:server', 'pack1', 'wave', true);

    store.set(portableImagePacksAtom, {
      type: 'UPSERT',
      roomId: '!a:server',
      stateKey: 'pack1',
      pack,
    });

    const result = store.get(portableImagePacksAtom);
    expect(result.size).toBe(1);
    expect(result.get('!a:server:pack1')).toBe(pack);
  });

  it('UPSERT with the same pack already in the map is a no-op (referential stability)', () => {
    const store = createStore();
    const pack = makePack('!a:server', 'pack1', 'wave', true);

    store.set(portableImagePacksAtom, {
      type: 'UPSERT',
      roomId: '!a:server',
      stateKey: 'pack1',
      pack,
    });
    const before = store.get(portableImagePacksAtom);

    store.set(portableImagePacksAtom, {
      type: 'UPSERT',
      roomId: '!a:server',
      stateKey: 'pack1',
      pack,
    });
    const after = store.get(portableImagePacksAtom);

    expect(after).toBe(before);
  });

  it('UPSERT with a non-portable pack removes an existing entry', () => {
    const store = createStore();
    const portable = makePack('!a:server', 'pack1', 'wave', true);
    const nonPortable = makePack('!a:server', 'pack1', 'wave', false);

    store.set(portableImagePacksAtom, {
      type: 'UPSERT',
      roomId: '!a:server',
      stateKey: 'pack1',
      pack: portable,
    });
    expect(store.get(portableImagePacksAtom).has('!a:server:pack1')).toBe(true);

    store.set(portableImagePacksAtom, {
      type: 'UPSERT',
      roomId: '!a:server',
      stateKey: 'pack1',
      pack: nonPortable,
    });

    expect(store.get(portableImagePacksAtom).has('!a:server:pack1')).toBe(false);
  });

  it('UPSERT with a non-portable pack on a missing key is a no-op (referential stability)', () => {
    const store = createStore();
    const before = store.get(portableImagePacksAtom);

    store.set(portableImagePacksAtom, {
      type: 'UPSERT',
      roomId: '!a:server',
      stateKey: 'pack1',
      pack: undefined,
    });

    expect(store.get(portableImagePacksAtom)).toBe(before);
  });

  it('PURGE_ROOM removes only entries belonging to that room', () => {
    const store = createStore();
    const packA = makePack('!a:server', 'pack1', 'wave', true);
    const packB = makePack('!b:server', 'pack1', 'smile', true);

    store.set(portableImagePacksAtom, {
      type: 'INITIALIZE',
      map: new Map([
        ['!a:server:pack1', packA],
        ['!b:server:pack1', packB],
      ]),
    });

    store.set(portableImagePacksAtom, { type: 'PURGE_ROOM', roomId: '!a:server' });

    const result = store.get(portableImagePacksAtom);
    expect(result.has('!a:server:pack1')).toBe(false);
    expect(result.get('!b:server:pack1')).toBe(packB);
  });

  it('PURGE_ROOM is a no-op when no entries belong to the room (referential stability)', () => {
    const store = createStore();
    const packA = makePack('!a:server', 'pack1', 'wave', true);

    store.set(portableImagePacksAtom, {
      type: 'INITIALIZE',
      map: new Map([['!a:server:pack1', packA]]),
    });
    const before = store.get(portableImagePacksAtom);

    store.set(portableImagePacksAtom, { type: 'PURGE_ROOM', roomId: '!c:server' });

    expect(store.get(portableImagePacksAtom)).toBe(before);
  });

  it('RESCAN_ROOM clears stale entries for the room and adds its current portable packs', () => {
    const store = createStore();
    const stalePack = makePack('!a:server', 'pack1', 'old', true);
    const otherRoomPack = makePack('!b:server', 'pack1', 'smile', true);
    const freshPack = makePack('!a:server', 'pack2', 'fresh', true);
    const nonPortableNoise = makePack('!a:server', 'pack3', 'noise', false);

    store.set(portableImagePacksAtom, {
      type: 'INITIALIZE',
      map: new Map([
        ['!a:server:pack1', stalePack],
        ['!b:server:pack1', otherRoomPack],
      ]),
    });

    getRoomImagePacksMock.mockReturnValue([freshPack, nonPortableNoise]);

    store.set(portableImagePacksAtom, {
      type: 'RESCAN_ROOM',
      room: makeRoomMock('!a:server'),
    });

    const result = store.get(portableImagePacksAtom);
    expect(result.has('!a:server:pack1')).toBe(false);
    expect(result.get('!a:server:pack2')).toBe(freshPack);
    expect(result.has('!a:server:pack3')).toBe(false);
    expect(result.get('!b:server:pack1')).toBe(otherRoomPack);
  });
});
