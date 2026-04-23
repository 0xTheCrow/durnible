import { atom } from 'jotai';
import { atomFamily } from 'jotai/utils';
import type { EncryptedAttachmentInfo } from 'browser-encrypt-attachment';
import type { IEventRelation } from 'matrix-js-sdk';
import { createUploadAtomFamily } from '../upload';
import type { UploadContent } from '../../utils/matrix';
import { createListAtom } from '../list';

export type UploadMetadata = {
  markedAsSpoiler: boolean;
};

export type UploadItem = {
  id: string;
  file: UploadContent;
  originalFile: UploadContent;
  metadata: UploadMetadata;
  encryptionInfo: EncryptedAttachmentInfo | undefined;
  isEncrypting?: boolean;
  isEncryptionSuccessful?: boolean;
  encryptError?: string;
};

export type UploadListAtom = ReturnType<typeof createListAtom<UploadItem>>;

export const roomIdToUploadItemsAtomFamily = atomFamily<string, UploadListAtom>(createListAtom);

export const roomUploadAtomFamily = createUploadAtomFamily();

const createEditorDraftAtom = () => atom<string>('');
export type EditorDraftAtom = ReturnType<typeof createEditorDraftAtom>;
export const roomIdToEditorDraftAtomFamily = atomFamily<string, EditorDraftAtom>(() =>
  createEditorDraftAtom()
);

export type ReplyDraft = {
  userId: string;
  eventId: string;
  body: string;
  formattedBody?: string | undefined;
  relation?: IEventRelation | undefined;
};
const createReplyDraftAtom = () => atom<ReplyDraft | undefined>(undefined);
export type ReplyDraftAtom = ReturnType<typeof createReplyDraftAtom>;
export const roomIdToReplyDraftAtomFamily = atomFamily<string, ReplyDraftAtom>(() =>
  createReplyDraftAtom()
);
