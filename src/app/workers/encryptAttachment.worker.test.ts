import { describe, it, expect, beforeAll, beforeEach, afterEach, vi } from 'vitest';

// The worker installs its handler on the dedicated-worker globals (self.onmessage /
// self.postMessage), which resolve to `globalThis` in the test environment. Tests
// drive it by calling onmessage directly and stubbing postMessage to capture the reply.

type WorkerInfo = {
  v: string;
  key: JsonWebKey;
  iv: string;
  hashes: { sha256: string };
};

type WorkerResponse = {
  id: string;
  data?: ArrayBuffer;
  info?: WorkerInfo;
  error?: string;
};

type WorkerGlobal = {
  onmessage: ((e: MessageEvent) => unknown) | null;
  postMessage: (msg: WorkerResponse) => void;
};

const workerGlobal = globalThis as unknown as WorkerGlobal;

const triggerWorker = (data: unknown): Promise<WorkerResponse> =>
  new Promise((resolve) => {
    workerGlobal.postMessage = vi.fn((msg: WorkerResponse) => resolve(msg));
    if (typeof workerGlobal.onmessage !== 'function') {
      throw new Error('worker onmessage handler was not installed');
    }
    workerGlobal.onmessage({ data } as MessageEvent);
  });

type SuccessResponse = { id: string; data: ArrayBuffer; info: WorkerInfo };

const expectSuccess = (result: WorkerResponse): SuccessResponse => {
  expect(result.error).toBeUndefined();
  expect(result.data).toBeDefined();
  expect(result.info).toBeDefined();
  return result as SuccessResponse;
};

const decodeUnpaddedBase64 = (b64: string): Uint8Array => {
  const padded = b64 + '='.repeat((4 - (b64.length % 4)) % 4);
  const bin = atob(padded);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i += 1) out[i] = bin.charCodeAt(i);
  return out;
};

const encodeUnpaddedBase64 = (buf: ArrayBuffer): string =>
  btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/=+$/, '');

describe('encryptAttachment.worker', () => {
  let originalPostMessage: WorkerGlobal['postMessage'];

  beforeAll(async () => {
    // Importing the worker module installs onmessage as the encrypt handler.
    await import('./encryptAttachment.worker');
  });

  beforeEach(() => {
    originalPostMessage = workerGlobal.postMessage;
  });

  afterEach(() => {
    workerGlobal.postMessage = originalPostMessage;
  });

  it('echoes the request id back on the response', async () => {
    const result = await triggerWorker({
      id: 'request-42',
      buffer: new TextEncoder().encode('hi').buffer,
    });
    expect(result.id).toBe('request-42');
  });

  it('returns ciphertext + v2 EncryptedAttachmentInfo with key, iv and sha256', async () => {
    const plaintext = new TextEncoder().encode('hello world').buffer;
    const result = expectSuccess(await triggerWorker({ id: '1', buffer: plaintext }));

    expect(result.data).toBeInstanceOf(ArrayBuffer);
    // AES-CTR is length-preserving — ciphertext byte length matches plaintext.
    expect(result.data.byteLength).toBe(plaintext.byteLength);

    expect(result.info).toMatchObject({
      v: 'v2',
      key: expect.objectContaining({
        kty: 'oct',
        alg: 'A256CTR',
        ext: true,
      }),
      iv: expect.any(String),
      hashes: { sha256: expect.any(String) },
    });
    expect(result.info.key.key_ops).toEqual(expect.arrayContaining(['encrypt', 'decrypt']));
  });

  it('uses a 16-byte IV with the upper 8 bytes zeroed (AES-CTR counter convention)', async () => {
    const result = expectSuccess(await triggerWorker({ id: '1', buffer: new ArrayBuffer(4) }));
    const iv = decodeUnpaddedBase64(result.info.iv);
    expect(iv.length).toBe(16);
    // Only the first 8 bytes are randomized; the trailing counter half starts at zero.
    expect(Array.from(iv.subarray(8))).toEqual([0, 0, 0, 0, 0, 0, 0, 0]);
  });

  it('reports a sha256 that matches the digest of the returned ciphertext', async () => {
    const plaintext = new TextEncoder().encode('verify me').buffer;
    const result = expectSuccess(await triggerWorker({ id: '1', buffer: plaintext }));

    const expectedHash = await crypto.subtle.digest('SHA-256', result.data);
    expect(result.info.hashes.sha256).toBe(encodeUnpaddedBase64(expectedHash));
  });

  it('produces ciphertext that round-trips back to the plaintext via the returned key+iv', async () => {
    const text = 'round trip test';
    const plaintext = new TextEncoder().encode(text);
    const result = expectSuccess(
      await triggerWorker({ id: '1', buffer: plaintext.buffer.slice(0) })
    );

    const importedKey = await crypto.subtle.importKey(
      'jwk',
      result.info.key,
      { name: 'AES-CTR' },
      false,
      ['decrypt']
    );

    const decrypted = await crypto.subtle.decrypt(
      { name: 'AES-CTR', counter: decodeUnpaddedBase64(result.info.iv), length: 64 },
      importedKey,
      result.data
    );

    expect(new TextDecoder().decode(decrypted)).toBe(text);
  });

  it('uses a fresh key and iv for every request', async () => {
    const makeBuffer = () => new TextEncoder().encode('same input').buffer;
    const a = expectSuccess(await triggerWorker({ id: 'a', buffer: makeBuffer() }));
    const b = expectSuccess(await triggerWorker({ id: 'b', buffer: makeBuffer() }));

    expect(a.info.key.k).toBeDefined();
    expect(a.info.key.k).not.toBe(b.info.key.k);
    expect(a.info.iv).not.toBe(b.info.iv);
    expect(new Uint8Array(a.data)).not.toEqual(new Uint8Array(b.data));
  });

  it('reports errors back via { id, error } when encryption fails', async () => {
    // A null buffer makes crypto.subtle.encrypt reject; the worker must catch and
    // forward the error keyed by the same id rather than throwing.
    const result = await triggerWorker({ id: 'err', buffer: null });

    expect(result.id).toBe('err');
    expect(typeof result.error).toBe('string');
    expect(result.error?.length ?? 0).toBeGreaterThan(0);
    expect(result.data).toBeUndefined();
    expect(result.info).toBeUndefined();
  });
});
