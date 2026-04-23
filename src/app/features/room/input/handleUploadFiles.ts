import type { ListAction } from '../../../state/list';
import type { UploadItem } from '../../../state/room/roomInputDrafts';
import { safeFile } from '../../../utils/mimeTypes';
import { applyUploadQueueCap } from '../../../utils/uploadQueueCap';
import type { EncryptFn } from './encryptAndReplace';
import { encryptAndReplace } from './encryptAndReplace';

export type { EncryptedFileResult } from './encryptAndReplace';

let nextUploadId = 0;
export const createUploadId = (): string => String(nextUploadId++);

export type HandleUploadFilesContext = {
  /** Number of items currently in the upload queue. Read once at call time. */
  currentItemCount: number;
  /** Reducer-style setter for the upload queue. */
  setItems: (action: ListAction<UploadItem>) => void;
  /** True iff the destination room has an encryption state event. */
  isEncrypted: boolean;
  /** Encrypts a single file (rejects on failure). */
  encrypt: EncryptFn;
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
 *  1. Cap against the queue's remaining capacity (drops excess silently).
 *  2. Sanitize each file's mime type via `safeFile`.
 *  3a. Encrypted room → PUT placeholders, then asynchronously REPLACE each
 *      with the encrypted result (or an error item on failure).
 *  3b. Plain room → PUT plain upload items.
 *  4. Fire `onAccepted` if at least one file made it through.
 *
 * Pure dependency injection — no React, no atoms, no DOM. The RoomInput
 * component is a thin adapter that wires its hooks/refs into the context.
 */
export function handleUploadFiles(
  files: File[],
  ctx: HandleUploadFilesContext
): HandleUploadFilesResult {
  const accepted = applyUploadQueueCap(ctx.currentItemCount, files);
  if (accepted.length === 0) {
    return { acceptedCount: 0, encryptionDone: Promise.resolve() };
  }

  const safeFiles = accepted.map(safeFile);

  if (ctx.isEncrypted) {
    const placeholders: UploadItem[] = safeFiles.map((f) => ({
      id: createUploadId(),
      file: f,
      originalFile: f,
      encryptionInfo: undefined,
      metadata: { markedAsSpoiler: false },
      isEncrypting: true,
    }));
    ctx.setItems({ type: 'PUT', item: placeholders });

    const encryptionTasks = placeholders.map((p) =>
      encryptAndReplace(p, ctx.encrypt, ctx.setItems)
    );

    ctx.onAccepted?.();
    return {
      acceptedCount: safeFiles.length,
      encryptionDone: Promise.all(encryptionTasks).then(() => undefined),
    };
  }

  const fileItems: UploadItem[] = safeFiles.map((f) => ({
    id: createUploadId(),
    file: f,
    originalFile: f,
    encryptionInfo: undefined,
    metadata: { markedAsSpoiler: false },
  }));
  ctx.setItems({ type: 'PUT', item: fileItems });
  ctx.onAccepted?.();
  return { acceptedCount: safeFiles.length, encryptionDone: Promise.resolve() };
}
