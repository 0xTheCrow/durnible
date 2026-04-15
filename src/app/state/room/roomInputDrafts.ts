import { atom } from 'jotai';
import { atomFamily } from 'jotai/utils';
import type { Descendant } from 'slate';
import type { EncryptedAttachmentInfo } from 'browser-encrypt-attachment';
import type { IEventRelation } from 'matrix-js-sdk';
import { createUploadAtomFamily } from '../upload';
import type { UploadContent } from '../../utils/matrix';
import { createListAtom } from '../list';

export type UploadMetadata = {
  markedAsSpoiler: boolean;
};

export type UploadItem = {
  file: UploadContent;
  originalFile: UploadContent;
  metadata: UploadMetadata;
  encInfo: EncryptedAttachmentInfo | undefined;
  isEncrypting?: boolean;
  isEncryptionSuccessful?: boolean;
  encryptError?: string;
};

export type UploadListAtom = ReturnType<typeof createListAtom<UploadItem>>;

export const roomIdToUploadItemsAtomFamily = atomFamily<string, UploadListAtom>(createListAtom);

export const roomUploadAtomFamily = createUploadAtomFamily();

export type RoomIdToMsgAction =
  | {
      type: 'PUT';
      roomId: string;
      msg: Descendant[];
    }
  | {
      type: 'DELETE';
      roomId: string;
    };

const createMsgDraftAtom = () => atom<Descendant[]>([]);
export type MsgDraftAtom = ReturnType<typeof createMsgDraftAtom>;
export const roomIdToMsgDraftAtomFamily = atomFamily<string, MsgDraftAtom>(() =>
  createMsgDraftAtom()
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
