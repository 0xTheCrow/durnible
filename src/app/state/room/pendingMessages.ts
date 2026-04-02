import { atom } from 'jotai';
import { atomFamily } from 'jotai/utils';
import { IContent } from 'matrix-js-sdk';

export type PendingStatus = 'pending' | 'failed';

export type PendingMessage = {
  id: string;
  content: IContent;
  addedAt: number;
  status: PendingStatus;
};

const createPendingMessagesAtom = () => atom<PendingMessage[]>([]);
export type TPendingMessagesAtom = ReturnType<typeof createPendingMessagesAtom>;

export const roomIdToPendingMessagesAtomFamily = atomFamily<string, TPendingMessagesAtom>(
  () => createPendingMessagesAtom()
);
