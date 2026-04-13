import type { EncryptedAttachmentInfo } from 'browser-encrypt-attachment';
import type { ListAction } from '../../state/list';
import type { UploadItem } from '../../state/room/roomInputDrafts';
import { safeFile } from '../../utils/mimeTypes';
import { applyUploadQueueCap } from '../../utils/uploadQueueCap';

/**
 * Shape of the result returned by an encryption function — matches what
 * `encryptFileInWorker` returns. Re-stated here so this module doesn't take
 * a dependency on the worker file (and so tests can construct fake values
 * without spinning up a real worker).
 */
export type EncryptedFileResult = {
  encInfo: EncryptedAttachmentInfo;
  file: File;
  originalFile: File | Blob;
};

export type HandleUploadFilesContext = {
  /** Number of items currently in the upload queue. Read once at call time. */
  currentItemCount: number;
  /** Reducer-style setter for the upload queue. */
  setItems: (action: ListAction<UploadItem>) => void;
  /** True iff the destination room has an encryption state event. */
  isEncrypted: boolean;
  /** Encrypts a single file (rejects on failure). */
  encrypt: (file: File) => Promise<EncryptedFileResult>;
  /** Open the upload board UI — fired regardless of whether files were accepted. */
  onUploadBoardOpen: () => void;
  /** Optional side effect after files are accepted (e.g. focus the send button). */
  onAccepted?: () => void;
};

export type HandleUploadFilesResult = {
  /** Number of files accepted into the queue (post-cap, post-safeFile). */
  acceptedCount: number;
  /**
   * Resolves once any in-flight encryption tasks have settled. For
   * unencrypted rooms this is an already-resolved Promise. Tests await
   * this to verify the final state of the queue.
   */
  encryptionDone: Promise<void>;
};

/**
 * Add an incoming batch of files to the room's upload queue.
 *
 * Pipeline:
 *  1. Open the upload board (always).
 *  2. Cap against the queue's remaining capacity (drops excess silently).
 *  3. Sanitize each file's mime type via `safeFile`.
 *  4a. Encrypted room → PUT placeholders, then asynchronously REPLACE each
 *      with the encrypted result (or an error item on failure).
 *  4b. Plain room → PUT plain upload items.
 *  5. Fire `onAccepted` if at least one file made it through.
 *
 * Pure dependency injection — no React, no atoms, no DOM. The RoomInput
 * component is a thin adapter that wires its hooks/refs into the context.
 */
export function handleUploadFiles(
  files: File[],
  ctx: HandleUploadFilesContext
): HandleUploadFilesResult {
  ctx.onUploadBoardOpen();

  const accepted = applyUploadQueueCap(ctx.currentItemCount, files);
  if (accepted.length === 0) {
    return { acceptedCount: 0, encryptionDone: Promise.resolve() };
  }

  const safeFiles = accepted.map(safeFile);

  if (ctx.isEncrypted) {
    const placeholders: UploadItem[] = safeFiles.map((f) => ({
      file: f,
      originalFile: f,
      encInfo: undefined,
      metadata: { markedAsSpoiler: false },
      isEncrypting: true,
    }));
    ctx.setItems({ type: 'PUT', item: placeholders });

    const encryptionTasks = safeFiles.map(async (f, i) => {
      try {
        const encrypted = await ctx.encrypt(f);
        ctx.setItems({
          type: 'REPLACE',
          item: placeholders[i],
          replacement: {
            ...encrypted,
            metadata: { markedAsSpoiler: false },
            isEncryptionSuccessful: true,
          },
        });
      } catch (e) {
        ctx.setItems({
          type: 'REPLACE',
          item: placeholders[i],
          replacement: {
            ...placeholders[i],
            file: new File([], f.name, { type: f.type }),
            isEncrypting: false,
            isEncryptionSuccessful: false,
            encryptError: e instanceof Error ? e.message : 'Encryption failed',
          },
        });
      }
    });

    ctx.onAccepted?.();
    return {
      acceptedCount: safeFiles.length,
      encryptionDone: Promise.all(encryptionTasks).then(() => undefined),
    };
  }

  const fileItems: UploadItem[] = safeFiles.map((f) => ({
    file: f,
    originalFile: f,
    encInfo: undefined,
    metadata: { markedAsSpoiler: false },
  }));
  ctx.setItems({ type: 'PUT', item: fileItems });
  ctx.onAccepted?.();
  return { acceptedCount: safeFiles.length, encryptionDone: Promise.resolve() };
}
