// https://github.com/matrix-org/matrix-react-sdk/blob/e78a1adb6f1af2ea425b0bae9034fb7344a4b2e8/src/utils/MegolmExportEncryption.js
//
// Byte packing/masking/shifting for the PBKDF2 + AES-CTR + HMAC envelope
// requires bitwise operators that airbnb's `no-bitwise` rule outlaws. There's
// no source-level alternative that doesn't make the code strictly worse.
/* eslint-disable no-bitwise */

// Some older Safari versions exposed `webkitSubtle` instead of `subtle`. The
// `as { webkitSubtle: SubtleCrypto }` cast lets us reach for the prefixed
// version without polluting the global Crypto type. If neither exists, the
// crypto operations will throw at first use, which the friendlyError wrappers
// translate to a "your browser doesn't support …" message.
const subtleCrypto: SubtleCrypto =
  window.crypto.subtle ?? (window.crypto as unknown as { webkitSubtle: SubtleCrypto }).webkitSubtle;

/**
 * Error subclass that carries a translated, user-facing message alongside
 * the technical message. Vendored from matrix-react-sdk where the surrounding
 * UI distinguished log message vs display message; cinny currently shows
 * `.message` directly so both fields end up visible to debugging only.
 */
class FriendlyError extends Error {
  friendlyText: string;

  constructor(msg: string, friendlyText: string) {
    super(msg);
    this.name = 'FriendlyError';
    this.friendlyText = friendlyText;
  }
}

function friendlyError(msg: string, friendlyText: string): FriendlyError {
  return new FriendlyError(msg, friendlyText);
}

function cryptoFailMsg(): string {
  return 'Your browser does not support the required cryptography extensions';
}

type EncryptOptions = {
  // eslint-disable-next-line camelcase
  kdf_rounds?: number;
};

/**
 * Derive the AES and HMAC-SHA-256 keys for the file.
 * Returns [aesKey, hmacKey].
 */
async function deriveKeys(
  salt: Uint8Array,
  iterations: number,
  password: string
): Promise<[CryptoKey, CryptoKey]> {
  let key: CryptoKey;
  try {
    key = await subtleCrypto.importKey(
      'raw',
      new TextEncoder().encode(password),
      { name: 'PBKDF2' },
      false,
      ['deriveBits']
    );
  } catch (e) {
    throw friendlyError(`subtleCrypto.importKey failed: ${e}`, cryptoFailMsg());
  }

  let keybits: ArrayBuffer;
  try {
    keybits = await subtleCrypto.deriveBits(
      {
        name: 'PBKDF2',
        salt,
        iterations,
        hash: 'SHA-512',
      },
      key,
      512
    );
  } catch (e) {
    throw friendlyError(`subtleCrypto.deriveBits failed: ${e}`, cryptoFailMsg());
  }

  const aesKey = keybits.slice(0, 32);
  const hmacKey = keybits.slice(32);

  const aesProm = subtleCrypto
    .importKey('raw', aesKey, { name: 'AES-CTR' }, false, ['encrypt', 'decrypt'])
    .catch((e: unknown) => {
      throw friendlyError(`subtleCrypto.importKey failed for AES key: ${e}`, cryptoFailMsg());
    });

  const hmacProm = subtleCrypto
    .importKey(
      'raw',
      hmacKey,
      {
        name: 'HMAC',
        hash: { name: 'SHA-256' },
      },
      false,
      ['sign', 'verify']
    )
    .catch((e: unknown) => {
      throw friendlyError(`subtleCrypto.importKey failed for HMAC key: ${e}`, cryptoFailMsg());
    });

  return Promise.all([aesProm, hmacProm]);
}

/**
 * Decode a base64 string to a typed array of uint8.
 */
function decodeBase64(base64: string): Uint8Array {
  // window.atob returns a unicode string with codepoints in the range 0-255.
  const latin1String = window.atob(base64);
  // Encode the string as a Uint8Array
  const uint8Array = new Uint8Array(latin1String.length);
  for (let i = 0; i < latin1String.length; i += 1) {
    uint8Array[i] = latin1String.charCodeAt(i);
  }
  return uint8Array;
}

/**
 * Encode a typed array of uint8 as base64.
 */
function encodeBase64(uint8Array: Uint8Array): string {
  // Misinterpret the Uint8Array as Latin-1.
  // window.btoa expects a unicode string with codepoints in the range 0-255.
  const latin1String = String.fromCharCode.apply(null, Array.from(uint8Array));
  // Use the builtin base64 encoder.
  return window.btoa(latin1String);
}

const HEADER_LINE = '-----BEGIN MEGOLM SESSION DATA-----';
const TRAILER_LINE = '-----END MEGOLM SESSION DATA-----';

/**
 * Unbase64 an ascii-armoured megolm key file.
 *
 * Strips the header and trailer lines, and unbase64s the content.
 */
function unpackMegolmKeyFile(data: ArrayBuffer): Uint8Array {
  // parse the file as a great big String. This should be safe, because there
  // should be no non-ASCII characters, and it means that we can do string
  // comparisons to find the header and footer, and feed it into window.atob.
  const fileStr = new TextDecoder().decode(new Uint8Array(data));

  // look for the start line
  let lineStart = 0;
  let foundHeader = false;
  while (!foundHeader) {
    const lineEnd = fileStr.indexOf('\n', lineStart);
    if (lineEnd < 0) {
      throw new Error('Header line not found');
    }
    const line = fileStr.slice(lineStart, lineEnd).trim();

    // start the next line after the newline
    lineStart = lineEnd + 1;

    if (line === HEADER_LINE) {
      foundHeader = true;
    }
  }

  const dataStart = lineStart;

  // look for the end line
  let foundTrailer = false;
  while (!foundTrailer) {
    const lineEnd = fileStr.indexOf('\n', lineStart);
    const line = fileStr.slice(lineStart, lineEnd < 0 ? undefined : lineEnd).trim();
    if (line === TRAILER_LINE) {
      foundTrailer = true;
    } else if (lineEnd < 0) {
      throw new Error('Trailer line not found');
    } else {
      // start the next line after the newline
      lineStart = lineEnd + 1;
    }
  }

  const dataEnd = lineStart;
  return decodeBase64(fileStr.slice(dataStart, dataEnd));
}

/**
 * Ascii-armour a megolm key file.
 *
 * base64s the content, and adds header and trailer lines.
 */
function packMegolmKeyFile(data: Uint8Array): ArrayBuffer {
  // we split into lines before base64ing, because encodeBase64 doesn't deal
  // terribly well with large arrays.
  const LINE_LENGTH = (72 * 4) / 3;
  const nLines = Math.ceil(data.length / LINE_LENGTH);
  const lines: string[] = new Array(nLines + 3);
  lines[0] = HEADER_LINE;
  let o = 0;
  let i = 1;
  for (; i <= nLines; i += 1) {
    lines[i] = encodeBase64(data.subarray(o, o + LINE_LENGTH));
    o += LINE_LENGTH;
  }
  lines[i] = TRAILER_LINE;
  i += 1;
  lines[i] = '';
  return new TextEncoder().encode(lines.join('\n')).buffer as ArrayBuffer;
}

export async function decryptMegolmKeyFile(data: ArrayBuffer, password: string): Promise<string> {
  const body = unpackMegolmKeyFile(data);

  // check we have a version byte
  if (body.length < 1) {
    throw friendlyError('Invalid file: too short', 'Not a valid keyfile');
  }

  const version = body[0];
  if (version !== 1) {
    throw friendlyError('Unsupported version', 'Not a valid keyfile');
  }

  const ciphertextLength = body.length - (1 + 16 + 16 + 4 + 32);
  if (ciphertextLength < 0) {
    throw friendlyError('Invalid file: too short', 'Not a valid keyfile');
  }

  const salt = body.subarray(1, 1 + 16);
  const iv = body.subarray(17, 17 + 16);
  const iterations = (body[33] << 24) | (body[34] << 16) | (body[35] << 8) | body[36];
  const ciphertext = body.subarray(37, 37 + ciphertextLength);
  const hmac = body.subarray(-32);

  const [aesKey, hmacKey] = await deriveKeys(salt, iterations, password);
  const toVerify = body.subarray(0, -32);

  let isValid: boolean;
  try {
    isValid = await subtleCrypto.verify({ name: 'HMAC' }, hmacKey, hmac, toVerify);
  } catch (e) {
    throw friendlyError(`subtleCrypto.verify failed: ${e}`, cryptoFailMsg());
  }
  if (!isValid) {
    throw friendlyError('hmac mismatch', 'Authentication check failed: Incorrect password?');
  }

  let plaintext: ArrayBuffer;
  try {
    plaintext = await subtleCrypto.decrypt(
      {
        name: 'AES-CTR',
        counter: iv,
        length: 64,
      },
      aesKey,
      ciphertext
    );
  } catch (e) {
    throw friendlyError(`subtleCrypto.decrypt failed: ${e}`, cryptoFailMsg());
  }

  return new TextDecoder().decode(new Uint8Array(plaintext));
}

/**
 * Encrypt a megolm key file.
 *
 * `options.kdf_rounds` controls the number of PBKDF2 iterations (default 500k).
 */
export async function encryptMegolmKeyFile(
  data: string,
  password: string,
  options?: EncryptOptions
): Promise<ArrayBuffer> {
  const opts = options ?? {};
  const kdfRounds = opts.kdf_rounds ?? 500000;

  const salt = new Uint8Array(16);
  window.crypto.getRandomValues(salt);

  const iv = new Uint8Array(16);
  window.crypto.getRandomValues(iv);

  // clear bit 63 of the IV to stop us hitting the 64-bit counter boundary
  // (which would mean we wouldn't be able to decrypt on Android). The loss
  // of a single bit of iv is a price we have to pay.
  iv[8] &= 0x7f;

  const [aesKey, hmacKey] = await deriveKeys(salt, kdfRounds, password);
  const encodedData = new TextEncoder().encode(data);

  let ciphertext: ArrayBuffer;
  try {
    ciphertext = await subtleCrypto.encrypt(
      {
        name: 'AES-CTR',
        counter: iv,
        length: 64,
      },
      aesKey,
      encodedData
    );
  } catch (e) {
    throw friendlyError(`subtleCrypto.encrypt failed: ${e}`, cryptoFailMsg());
  }

  const cipherArray = new Uint8Array(ciphertext);
  const bodyLength = 1 + salt.length + iv.length + 4 + cipherArray.length + 32;
  const resultBuffer = new Uint8Array(bodyLength);
  let idx = 0;
  resultBuffer[idx] = 1; // version
  idx += 1;
  resultBuffer.set(salt, idx);
  idx += salt.length;
  resultBuffer.set(iv, idx);
  idx += iv.length;
  resultBuffer[idx] = kdfRounds >> 24;
  idx += 1;
  resultBuffer[idx] = (kdfRounds >> 16) & 0xff;
  idx += 1;
  resultBuffer[idx] = (kdfRounds >> 8) & 0xff;
  idx += 1;
  resultBuffer[idx] = kdfRounds & 0xff;
  idx += 1;
  resultBuffer.set(cipherArray, idx);
  idx += cipherArray.length;

  const toSign = resultBuffer.subarray(0, idx);

  let hmac: ArrayBuffer;
  try {
    hmac = await subtleCrypto.sign({ name: 'HMAC' }, hmacKey, toSign);
  } catch (e) {
    throw friendlyError(`subtleCrypto.sign failed: ${e}`, cryptoFailMsg());
  }

  const hmacArray = new Uint8Array(hmac);
  resultBuffer.set(hmacArray, idx);
  return packMegolmKeyFile(resultBuffer);
}
