import { atom } from 'jotai';
import type { Room } from 'matrix-js-sdk';
import type { Relations } from 'matrix-js-sdk/lib/models/relations';

export type ReactionViewerState = {
  room: Room;
  relations: Relations;
  initialKey?: string;
};

export const reactionViewerAtom = atom<ReactionViewerState | undefined>(undefined);
