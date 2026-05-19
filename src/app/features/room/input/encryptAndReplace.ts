import type { EncryptedAttachmentInfo } from 'browser-encrypt-attachment';
import type { ListAction } from '../../../state/list';
import type { UploadItem } from '../../../state/room/roomInputDrafts';

export type EncryptedFileResult = {
  encryptionInfo: EncryptedAttachmentInfo;
  file: File;
  originalFile: File;
};

export type EncryptFn = (file: File) => Promise<EncryptedFileResult>;

export async function encryptAndReplace(
  placeholder: UploadItem,
  encrypt: EncryptFn,
  setItems: (action: ListAction<UploadItem>) => void
): Promise<void> {
  const sourceFile = placeholder.originalFile;
  try {
    const encrypted = await encrypt(sourceFile);
    setItems({
      type: 'REPLACE',
      item: placeholder,
      replacement: {
        ...encrypted,
        id: placeholder.id,
        metadata: placeholder.metadata,
        isEncryptionSuccessful: true,
      },
    });
  } catch (e) {
    setItems({
      type: 'REPLACE',
      item: placeholder,
      replacement: {
        ...placeholder,
        file: new File([], sourceFile.name, { type: sourceFile.type }),
        isEncrypting: false,
        isEncryptionSuccessful: false,
        encryptError: e instanceof Error ? e.message : 'Encryption failed',
      },
    });
  }
}
