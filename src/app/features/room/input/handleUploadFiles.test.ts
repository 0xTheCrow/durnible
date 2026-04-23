import type { EncryptedAttachmentInfo } from 'browser-encrypt-attachment';
import { describe, it, expect, vi } from 'vitest';
import type { ListAction } from '../../../state/list';
import type { UploadItem } from '../../../state/room/roomInputDrafts';
import type { EncryptedFileResult, HandleUploadFilesContext } from './handleUploadFiles';
import { handleUploadFiles } from './handleUploadFiles';
import { MAX_UPLOAD_QUEUE_SIZE } from '../../../utils/uploadQueueCap';
import { FALLBACK_MIMETYPE } from '../../../utils/mimeTypes';

// ─── Fixtures ────────────────────────────────────────────────────────────────

const FAKE_ENC_INFO = { v: 'v2' } as unknown as EncryptedAttachmentInfo;

const makeFile = (name: string, type = 'image/png'): File => new File(['fake'], name, { type });

const makeImages = (count: number): File[] =>
  Array.from({ length: count }, (_, i) => makeFile(`img-${i}.png`));

const successfulEncrypt = async (f: File): Promise<EncryptedFileResult> => ({
  encInfo: FAKE_ENC_INFO,
  file: new File(['enc'], f.name, { type: 'application/octet-stream' }),
  originalFile: f,
});

type Setup = {
  ctx: HandleUploadFilesContext;
  setItems: ReturnType<typeof vi.fn>;
  onAccepted: ReturnType<typeof vi.fn>;
  encrypt: ReturnType<typeof vi.fn>;
};

const setup = (overrides: Partial<HandleUploadFilesContext> = {}): Setup => {
  const setItems = vi.fn();
  const onAccepted = vi.fn();
  const encrypt = vi.fn(successfulEncrypt);
  const ctx: HandleUploadFilesContext = {
    currentItemCount: 0,
    setItems,
    isEncrypted: false,
    encrypt,
    onAccepted,
    ...overrides,
  };
  // If a caller overrode encrypt, replace our spy reference so the returned
  // handle still points at whatever they passed in.
  return {
    ctx,
    setItems,
    onAccepted,
    encrypt: (overrides.encrypt as ReturnType<typeof vi.fn>) ?? encrypt,
  };
};

const itemsFromPut = (action: ListAction<UploadItem>): UploadItem[] => {
  if (action.type !== 'PUT') throw new Error(`expected PUT, got ${action.type}`);
  return Array.isArray(action.item) ? action.item : [action.item];
};

const replacementOf = (action: ListAction<UploadItem>): UploadItem => {
  if (action.type !== 'REPLACE') throw new Error(`expected REPLACE, got ${action.type}`);
  return action.replacement;
};

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('handleUploadFiles', () => {
  describe('side effects', () => {
    it('does not fire onAccepted or setItems when no files are accepted', () => {
      const { ctx, setItems, onAccepted } = setup({
        currentItemCount: MAX_UPLOAD_QUEUE_SIZE,
      });
      handleUploadFiles(makeImages(3), ctx);
      expect(setItems).not.toHaveBeenCalled();
      expect(onAccepted).not.toHaveBeenCalled();
    });

    it('fires onAccepted after files are queued', () => {
      const { ctx, onAccepted } = setup();
      handleUploadFiles(makeImages(2), ctx);
      expect(onAccepted).toHaveBeenCalledTimes(1);
    });
  });

  describe('queue cap', () => {
    it('accepts a small batch into an empty queue', () => {
      const { ctx, setItems } = setup();
      const result = handleUploadFiles(makeImages(3), ctx);
      expect(result.acceptedCount).toBe(3);
      expect(itemsFromPut(setItems.mock.calls[0][0])).toHaveLength(3);
    });

    it('fills an empty queue up to the cap in a single batch', () => {
      const { ctx, setItems } = setup();
      const result = handleUploadFiles(makeImages(MAX_UPLOAD_QUEUE_SIZE), ctx);
      expect(result.acceptedCount).toBe(MAX_UPLOAD_QUEUE_SIZE);
      expect(itemsFromPut(setItems.mock.calls[0][0])).toHaveLength(MAX_UPLOAD_QUEUE_SIZE);
    });

    it('drops the overflow when an over-capacity batch arrives', () => {
      // 2 slots remaining; more incoming than remaining → only 2 fit.
      const { ctx, setItems } = setup({ currentItemCount: MAX_UPLOAD_QUEUE_SIZE - 2 });
      const result = handleUploadFiles(makeImages(MAX_UPLOAD_QUEUE_SIZE), ctx);
      expect(result.acceptedCount).toBe(2);
      expect(itemsFromPut(setItems.mock.calls[0][0])).toHaveLength(2);
    });

    it('rejects all files when the queue is already at the cap', () => {
      const { ctx, setItems } = setup({ currentItemCount: MAX_UPLOAD_QUEUE_SIZE });
      const result = handleUploadFiles(makeImages(3), ctx);
      expect(result.acceptedCount).toBe(0);
      expect(setItems).not.toHaveBeenCalled();
    });

    it('preserves the original order when truncating a batch to fit', () => {
      const { ctx, setItems } = setup({ currentItemCount: MAX_UPLOAD_QUEUE_SIZE - 2 });
      const incoming = [makeFile('a.png'), makeFile('b.png'), makeFile('c.png'), makeFile('d.png')];
      handleUploadFiles(incoming, ctx);
      const items = itemsFromPut(setItems.mock.calls[0][0]);
      expect(items.map((i) => i.file.name)).toEqual(['a.png', 'b.png']);
    });
  });

  describe('mime type sanitization', () => {
    it('passes accepted files through safeFile (rewrites disallowed types to the fallback)', () => {
      const { ctx, setItems } = setup();
      const weird = new File(['x'], 'weird.bin', { type: 'application/x-weird' });
      handleUploadFiles([weird], ctx);
      const items = itemsFromPut(setItems.mock.calls[0][0]);
      expect(items[0].file.type).toBe(FALLBACK_MIMETYPE);
      expect(items[0].file.name).toBe('weird.bin');
    });

    it('leaves valid image mime types untouched', () => {
      const { ctx, setItems } = setup();
      handleUploadFiles([makeFile('photo.png', 'image/png')], ctx);
      const items = itemsFromPut(setItems.mock.calls[0][0]);
      expect(items[0].file.type).toBe('image/png');
    });
  });

  describe('unencrypted room', () => {
    it('PUTs plain upload items in a single dispatch', () => {
      const { ctx, setItems } = setup({ isEncrypted: false });
      handleUploadFiles(makeImages(3), ctx);
      expect(setItems).toHaveBeenCalledTimes(1);
      const items = itemsFromPut(setItems.mock.calls[0][0]);
      expect(items).toHaveLength(3);
    });

    it('items have no encryption metadata and default markedAsSpoiler: false', () => {
      const { ctx, setItems } = setup({ isEncrypted: false });
      handleUploadFiles(makeImages(2), ctx);
      const items = itemsFromPut(setItems.mock.calls[0][0]);
      items.forEach((item) => {
        expect(item.encInfo).toBeUndefined();
        expect(item.isEncrypting).toBeUndefined();
        expect(item.metadata.markedAsSpoiler).toBe(false);
        expect(item.file).toBe(item.originalFile);
      });
    });

    it('does not call the encrypt function', async () => {
      const { ctx, encrypt } = setup({ isEncrypted: false });
      const result = handleUploadFiles(makeImages(2), ctx);
      await result.encryptionDone;
      expect(encrypt).not.toHaveBeenCalled();
    });
  });

  describe('encrypted room', () => {
    it('PUTs placeholders with isEncrypting: true immediately', () => {
      const { ctx, setItems } = setup({ isEncrypted: true });
      handleUploadFiles(makeImages(2), ctx);
      const items = itemsFromPut(setItems.mock.calls[0][0]);
      expect(items).toHaveLength(2);
      items.forEach((item) => {
        expect(item.isEncrypting).toBe(true);
        expect(item.encInfo).toBeUndefined();
        expect(item.metadata.markedAsSpoiler).toBe(false);
      });
    });

    it('REPLACEs each placeholder with the encrypted result on success', async () => {
      const { ctx, setItems, encrypt } = setup({ isEncrypted: true });
      const result = handleUploadFiles(makeImages(2), ctx);
      await result.encryptionDone;

      // First call: PUT placeholders. Next two: REPLACE per file.
      expect(setItems).toHaveBeenCalledTimes(3);
      expect(encrypt).toHaveBeenCalledTimes(2);

      const replacements = setItems.mock.calls
        .slice(1)
        .map((c) => replacementOf(c[0] as ListAction<UploadItem>));
      replacements.forEach((replacement) => {
        expect(replacement.isEncryptionSuccessful).toBe(true);
        expect(replacement.encInfo).toBe(FAKE_ENC_INFO);
        expect(replacement.metadata.markedAsSpoiler).toBe(false);
      });
    });

    it('REPLACEs a placeholder with an error item when encryption fails', async () => {
      const failingEncrypt = vi.fn().mockRejectedValue(new Error('boom'));
      const { ctx, setItems } = setup({
        isEncrypted: true,
        encrypt: failingEncrypt as unknown as HandleUploadFilesContext['encrypt'],
      });
      const result = handleUploadFiles(makeImages(1), ctx);
      await result.encryptionDone;

      const replacement = replacementOf(setItems.mock.calls[1][0] as ListAction<UploadItem>);
      expect(replacement.isEncryptionSuccessful).toBe(false);
      expect(replacement.isEncrypting).toBe(false);
      expect(replacement.encryptError).toBe('boom');
    });

    it('uses a generic error message when the encryption rejection is not an Error', async () => {
      const failingEncrypt = vi.fn().mockRejectedValue('not an Error instance');
      const { ctx, setItems } = setup({
        isEncrypted: true,
        encrypt: failingEncrypt as unknown as HandleUploadFilesContext['encrypt'],
      });
      const result = handleUploadFiles(makeImages(1), ctx);
      await result.encryptionDone;

      const replacement = replacementOf(setItems.mock.calls[1][0] as ListAction<UploadItem>);
      expect(replacement.encryptError).toBe('Encryption failed');
    });

    it('handles partial failure: some files encrypt, others fail', async () => {
      let callIdx = 0;
      const partialEncrypt = vi.fn(async (f: File): Promise<EncryptedFileResult> => {
        const i = callIdx;
        callIdx += 1;
        if (i === 1) throw new Error('this one failed');
        return successfulEncrypt(f);
      });
      const { ctx, setItems } = setup({
        isEncrypted: true,
        encrypt: partialEncrypt as unknown as HandleUploadFilesContext['encrypt'],
      });
      const result = handleUploadFiles(makeImages(3), ctx);
      await result.encryptionDone;

      // 1 PUT + 3 REPLACEs
      expect(setItems).toHaveBeenCalledTimes(4);
      const replacements = setItems.mock.calls
        .slice(1)
        .map((c) => replacementOf(c[0] as ListAction<UploadItem>));
      const successes = replacements.filter((r) => r.isEncryptionSuccessful === true);
      const failures = replacements.filter((r) => r.isEncryptionSuccessful === false);
      expect(successes).toHaveLength(2);
      expect(failures).toHaveLength(1);
    });
  });

  describe('cap interaction with encryption', () => {
    it('only encrypts the files that survived the cap', async () => {
      const { ctx, encrypt } = setup({ isEncrypted: true, currentItemCount: 4 });
      const result = handleUploadFiles(makeImages(5), ctx);
      await result.encryptionDone;
      // 5 incoming, 4 already queued → only 2 fit → only 2 encrypt calls.
      expect(encrypt).toHaveBeenCalledTimes(2);
    });
  });
});
