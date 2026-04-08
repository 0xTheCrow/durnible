import { atom } from 'jotai';
import { Room } from 'matrix-js-sdk';
import { Relations } from 'matrix-js-sdk/lib/models/relations';

export type ReactionViewerState = {
  room: Room;
  relations: Relations;
  initialKey?: string;
};

export const reactionViewerAtom = atom<ReactionViewerState | undefined>(undefined);
