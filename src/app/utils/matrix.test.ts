import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  isServerName,
  getMxIdServer,
  getMxIdLocalPart,
  isUserId,
  isRoomAlias,
  probeAudioDurationMs,
} from './matrix';

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

type Listener = () => void;

type AudioMock = {
  duration: number;
  currentTime: number;
  preload: string;
  src: string;
  load: () => void;
  addEventListener: (type: string, listener: Listener) => void;
  removeEventListener: (type: string, listener: Listener) => void;
  fire: (type: string) => void;
};

const createAudioMock = (initialDuration: number): AudioMock => {
  const listeners = new Map<string, Set<Listener>>();
  return {
    duration: initialDuration,
    currentTime: 0,
    preload: '',
    src: '',
    load: vi.fn(),
    addEventListener(type, listener) {
      if (!listeners.has(type)) listeners.set(type, new Set());
      listeners.get(type)!.add(listener);
    },
    removeEventListener(type, listener) {
      listeners.get(type)?.delete(listener);
    },
    fire(type) {
      listeners.get(type)?.forEach((l) => l());
    },
  };
};

let currentAudio: AudioMock | undefined;

const installAudioMock = (initialDuration: number): AudioMock => {
  const audio = createAudioMock(initialDuration);
  currentAudio = audio;
  return audio;
};

describe('probeAudioDurationMs', () => {
  beforeEach(() => {
    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:fake-url');
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => undefined);
    vi.spyOn(document, 'createElement').mockImplementation(((tag: string) => {
      if (tag === 'audio' && currentAudio) return currentAudio;
      return document.createElementNS('http://www.w3.org/1999/xhtml', tag);
    }) as typeof document.createElement);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
    currentAudio = undefined;
  });

  it('returns rounded milliseconds when duration is finite', async () => {
    const audio = installAudioMock(5.5);
    const file = new File(['fake'], 'a.ogg', { type: 'audio/ogg' });
    const promise = probeAudioDurationMs(file);

    audio.fire('loadedmetadata');

    expect(await promise).toBe(5500);
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:fake-url');
  });

  it('applies the seek-to-end workaround when duration is Infinity', async () => {
    const audio = installAudioMock(Infinity);
    const file = new File(['fake'], 'voice.webm', { type: 'audio/webm' });
    const promise = probeAudioDurationMs(file);

    audio.fire('loadedmetadata');
    expect(audio.currentTime).toBe(Number.MAX_SAFE_INTEGER);

    audio.duration = 7;
    audio.fire('durationchange');

    expect(await promise).toBe(7000);
  });

  it('ignores durationchange events that still report a non-finite value', async () => {
    const audio = installAudioMock(Infinity);
    const file = new File(['fake'], 'voice.webm', { type: 'audio/webm' });
    const promise = probeAudioDurationMs(file);

    audio.fire('loadedmetadata');

    audio.fire('durationchange');
    audio.duration = 12;
    audio.fire('durationchange');

    expect(await promise).toBe(12000);
  });

  it('returns undefined when the audio element fires an error event', async () => {
    const audio = installAudioMock(0);
    const file = new File(['fake'], 'broken.mp3', { type: 'audio/mp3' });
    const promise = probeAudioDurationMs(file);

    audio.fire('error');

    expect(await promise).toBeUndefined();
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:fake-url');
  });

  it('returns undefined when no events ever fire (overall timeout)', async () => {
    vi.useFakeTimers();
    installAudioMock(0);
    const file = new File(['fake'], 'slow.ogg', { type: 'audio/ogg' });
    const promise = probeAudioDurationMs(file);

    await vi.advanceTimersByTimeAsync(5000);
    expect(await promise).toBeUndefined();
  });

  it('returns undefined when the seek-to-end never fires durationchange', async () => {
    vi.useFakeTimers();
    const audio = installAudioMock(Infinity);
    const file = new File(['fake'], 'voice.webm', { type: 'audio/webm' });
    const promise = probeAudioDurationMs(file);

    audio.fire('loadedmetadata');
    await vi.advanceTimersByTimeAsync(5000);

    expect(await promise).toBeUndefined();
  });
});
