/// <reference lib="webworker" />
export {}; // ensure module scope

self.onmessage = async (e: MessageEvent<{ id: string; buffer: ArrayBuffer }>) => {
  const { id, buffer } = e.data;
  try {
    const ivArray = new Uint8Array(16);
    self.crypto.getRandomValues(ivArray.subarray(0, 8));

    const cryptoKey = await self.crypto.subtle.generateKey(
      { name: 'AES-CTR', length: 256 },
      true,
      ['encrypt', 'decrypt']
    );
    const exportedKey = await self.crypto.subtle.exportKey('jwk', cryptoKey);
    const ciphertextBuffer = await self.crypto.subtle.encrypt(
      { name: 'AES-CTR', counter: ivArray, length: 64 },
      cryptoKey,
      buffer
    );
    const sha256Buffer = await self.crypto.subtle.digest('SHA-256', ciphertextBuffer);

    const encodeBase64 = (u8: Uint8Array) => {
      const latin1 = String.fromCharCode.apply(null, Array.from(u8));
      const padded = btoa(latin1);
      const outLen = 4 * Math.floor((u8.length + 2) / 3) + ((u8.length + 2) % 3) - 2;
      return padded.slice(0, outLen);
    };

    const info = {
      v: 'v2',
      key: exportedKey,
      iv: encodeBase64(ivArray),
      hashes: { sha256: encodeBase64(new Uint8Array(sha256Buffer)) },
    };

    (self as DedicatedWorkerGlobalScope).postMessage({ id, data: ciphertextBuffer, info }, [
      ciphertextBuffer,
    ]);
  } catch (err) {
    (self as DedicatedWorkerGlobalScope).postMessage({ id, error: String(err) });
  }
};
