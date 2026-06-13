import { describe, it, expect } from 'vitest';
import type { Room, WrappedReceipt } from 'matrix-js-sdk';
import { ReceiptType } from 'matrix-js-sdk';
import { getReadReceiptEventId } from './receipts';

const USER_ID = '@me:example.com';

const receipt = (eventId: string, ts: number): WrappedReceipt => ({ eventId, data: { ts } });

const mockRoom = (options: {
  publicReceipt?: WrappedReceipt;
  privateReceipt?: WrappedReceipt;
}): Room =>
  ({
    getReadReceiptForUserId: (
      _userId: string,
      _ignoreSynthesized?: boolean,
      type?: ReceiptType
    ) => {
      if (type === ReceiptType.Read) return options.publicReceipt ?? null;
      if (type === ReceiptType.ReadPrivate) return options.privateReceipt ?? null;
      return null;
    },
  } as unknown as Room);

describe('getReadReceiptEventId', () => {
  it('returns the private receipt id when only a private receipt exists', () => {
    const room = mockRoom({ privateReceipt: receipt('$private', 100) });
    expect(getReadReceiptEventId(room, USER_ID)).toBe('$private');
  });

  it('returns the public receipt id when the public receipt is newer', () => {
    const room = mockRoom({
      publicReceipt: receipt('$public', 200),
      privateReceipt: receipt('$private', 100),
    });
    expect(getReadReceiptEventId(room, USER_ID)).toBe('$public');
  });

  it('returns the private receipt id when the private receipt is newer', () => {
    const room = mockRoom({
      publicReceipt: receipt('$public', 100),
      privateReceipt: receipt('$private', 200),
    });
    expect(getReadReceiptEventId(room, USER_ID)).toBe('$private');
  });

  it('prefers the private receipt id when both have the same timestamp', () => {
    const room = mockRoom({
      publicReceipt: receipt('$public', 100),
      privateReceipt: receipt('$private', 100),
    });
    expect(getReadReceiptEventId(room, USER_ID)).toBe('$private');
  });
});
