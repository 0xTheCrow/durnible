import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { SAVE_CHUNK_SIZE_BYTES, saveFileOnMobile } from './fileSave';

type SentPayload = string | ArrayBuffer;

type BridgeStub = {
  sent: SentPayload[];
  sentControlTypes: () => string[];
  sentChunks: () => ArrayBuffer[];
  reply: (reply: Record<string, unknown>) => void;
  listenerCount: () => number;
};

const installBridgeStub = (): BridgeStub => {
  const listeners = new Set<(event: MessageEvent) => void>();
  const sent: SentPayload[] = [];

  (window as unknown as Record<string, unknown>).durnibleFileSave = {
    postMessage: (payload: SentPayload) => {
      sent.push(payload);
    },
    addEventListener: (_type: 'message', listener: (event: MessageEvent) => void) => {
      listeners.add(listener);
    },
    removeEventListener: (_type: 'message', listener: (event: MessageEvent) => void) => {
      listeners.delete(listener);
    },
  };

  return {
    sent,
    sentControlTypes: () =>
      sent
        .filter((payload): payload is string => typeof payload === 'string')
        .map((payload) => JSON.parse(payload).type as string),
    sentChunks: () => sent.filter((payload): payload is ArrayBuffer => typeof payload !== 'string'),
    reply: (reply) => {
      const event = { data: JSON.stringify(reply) } as MessageEvent;
      listeners.forEach((listener) => listener(event));
    },
    listenerCount: () => listeners.size,
  };
};

const flush = () =>
  new Promise((resolve) => {
    setTimeout(resolve, 0);
  });

const blobOfSize = (size: number): Blob => {
  const bytes = new Uint8Array(size);
  for (let i = 0; i < size; i += 1) bytes[i] = i % 251;
  return new Blob([bytes], { type: 'application/octet-stream' });
};

/** Drives a save to completion, acknowledging every request the bridge receives. */
const acknowledgeUntilSettled = async (bridge: BridgeStub, savePromise: Promise<unknown>) => {
  let settled = false;
  savePromise.then(
    () => {
      settled = true;
    },
    () => {
      settled = true;
    }
  );
  for (let step = 0; step < 50 && !settled; step += 1) {
    await flush();
    if (settled) break;
    const isFinish = bridge.sentControlTypes().at(-1) === 'finish';
    bridge.reply(isFinish ? { type: 'done', savedTo: 'Download/file' } : { type: 'acknowledged' });
  }
  await flush();
};

describe('saveFileOnMobile', () => {
  let bridge: BridgeStub;

  beforeEach(() => {
    bridge = installBridgeStub();
  });

  afterEach(() => {
    delete (window as unknown as Record<string, unknown>).durnibleFileSave;
    vi.restoreAllMocks();
  });

  it('sends begin, then chunks, then finish', async () => {
    const savePromise = saveFileOnMobile(blobOfSize(1024), 'note.txt');
    await acknowledgeUntilSettled(bridge, savePromise);

    await expect(savePromise).resolves.toBe('Download/file');
    expect(bridge.sentControlTypes()).toEqual(['begin', 'finish']);
    expect(bridge.sentChunks()).toHaveLength(1);
  });

  it('names the file and its mime type in the begin message', async () => {
    const savePromise = saveFileOnMobile(new Blob(['x'], { type: 'image/png' }), 'photo.png');
    await acknowledgeUntilSettled(bridge, savePromise);

    const begin = JSON.parse(bridge.sent[0] as string);
    expect(begin).toMatchObject({ type: 'begin', filename: 'photo.png', mimeType: 'image/png' });
  });

  it('falls back to a generic mime type when the blob has none', async () => {
    const savePromise = saveFileOnMobile(new Blob(['x']), 'unknown.bin');
    await acknowledgeUntilSettled(bridge, savePromise);

    expect(JSON.parse(bridge.sent[0] as string).mimeType).toBe('application/octet-stream');
  });

  it('reassembles the sent chunks into the original bytes', async () => {
    const size = SAVE_CHUNK_SIZE_BYTES + 1234;
    const original = blobOfSize(size);
    const savePromise = saveFileOnMobile(original, 'big.bin');
    await acknowledgeUntilSettled(bridge, savePromise);

    const chunks = bridge.sentChunks();
    expect(chunks).toHaveLength(2);
    expect(chunks[0].byteLength).toBe(SAVE_CHUNK_SIZE_BYTES);
    expect(chunks[1].byteLength).toBe(1234);

    const received = Buffer.concat(chunks.map((chunk) => Buffer.from(chunk)));
    const expected = Buffer.from(await original.arrayBuffer());
    expect(received.length).toBe(size);
    expect(Buffer.compare(received, expected)).toBe(0);
  });

  it('sends one chunk for a blob of exactly the chunk size', async () => {
    const savePromise = saveFileOnMobile(blobOfSize(SAVE_CHUNK_SIZE_BYTES), 'exact.bin');
    await acknowledgeUntilSettled(bridge, savePromise);

    expect(bridge.sentChunks()).toHaveLength(1);
  });

  it('sends two chunks for a blob one byte over the chunk size', async () => {
    const savePromise = saveFileOnMobile(blobOfSize(SAVE_CHUNK_SIZE_BYTES + 1), 'over.bin');
    await acknowledgeUntilSettled(bridge, savePromise);

    const chunks = bridge.sentChunks();
    expect(chunks).toHaveLength(2);
    expect(chunks[1].byteLength).toBe(1);
  });

  it('waits for each chunk to be acknowledged before sending the next', async () => {
    const savePromise = saveFileOnMobile(blobOfSize(SAVE_CHUNK_SIZE_BYTES * 2), 'paced.bin');
    savePromise.catch(() => undefined);

    await flush();
    bridge.reply({ type: 'acknowledged' });
    await flush();
    expect(bridge.sentChunks()).toHaveLength(1);

    await flush();
    expect(bridge.sentChunks()).toHaveLength(1);

    bridge.reply({ type: 'acknowledged' });
    await flush();
    expect(bridge.sentChunks()).toHaveLength(2);

    await acknowledgeUntilSettled(bridge, savePromise);
  });

  it('stops without sending chunks when the picker is cancelled', async () => {
    const savePromise = saveFileOnMobile(blobOfSize(1024), 'cancelled.bin');

    await flush();
    bridge.reply({ type: 'cancelled' });

    await expect(savePromise).resolves.toBeUndefined();
    expect(bridge.sentChunks()).toHaveLength(0);
    expect(bridge.sentControlTypes()).toEqual(['begin']);
  });

  it('aborts the started save when a chunk fails', async () => {
    const savePromise = saveFileOnMobile(blobOfSize(1024), 'failing.bin');
    savePromise.catch(() => undefined);

    await flush();
    bridge.reply({ type: 'acknowledged' });
    await flush();
    bridge.reply({ type: 'error', message: 'disk full' });
    await flush();
    bridge.reply({ type: 'acknowledged' });

    await expect(savePromise).rejects.toThrow('disk full');
    expect(bridge.sentControlTypes()).toEqual(['begin', 'abort']);
  });

  it('does not abort when begin itself fails', async () => {
    const savePromise = saveFileOnMobile(blobOfSize(1024), 'nostart.bin');
    savePromise.catch(() => undefined);

    await flush();
    bridge.reply({ type: 'error', message: 'no permission' });

    await expect(savePromise).rejects.toThrow('no permission');
    expect(bridge.sentControlTypes()).toEqual(['begin']);
  });

  it('stops listening for replies once a save settles', async () => {
    const savePromise = saveFileOnMobile(blobOfSize(1024), 'tidy.bin');
    await acknowledgeUntilSettled(bridge, savePromise);

    expect(bridge.listenerCount()).toBe(0);
  });

  it('runs concurrent saves one after another', async () => {
    const first = saveFileOnMobile(blobOfSize(1024), 'first.bin');
    const second = saveFileOnMobile(blobOfSize(1024), 'second.bin');
    second.catch(() => undefined);

    await flush();
    expect(bridge.sentControlTypes()).toEqual(['begin']);
    expect(JSON.parse(bridge.sent[0] as string).filename).toBe('first.bin');

    await acknowledgeUntilSettled(bridge, first);
    await expect(first).resolves.toBe('Download/file');

    await acknowledgeUntilSettled(bridge, second);
    await expect(second).resolves.toBe('Download/file');

    const beginFilenames = bridge.sent
      .filter((payload): payload is string => typeof payload === 'string')
      .map((payload) => JSON.parse(payload))
      .filter((message) => message.type === 'begin')
      .map((message) => message.filename);
    expect(beginFilenames).toEqual(['first.bin', 'second.bin']);
  });

  it('starts a queued save even after the previous one fails', async () => {
    const failing = saveFileOnMobile(blobOfSize(1024), 'bad.bin');
    failing.catch(() => undefined);
    const following = saveFileOnMobile(blobOfSize(1024), 'good.bin');
    following.catch(() => undefined);

    await flush();
    bridge.reply({ type: 'error', message: 'nope' });
    await expect(failing).rejects.toThrow('nope');

    await acknowledgeUntilSettled(bridge, following);
    await expect(following).resolves.toBe('Download/file');
  });
});
