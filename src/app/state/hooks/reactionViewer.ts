import { useCallback } from 'react';
import { useAtomValue, useSetAtom } from 'jotai';
import { Room } from 'matrix-js-sdk';
import { Relations } from 'matrix-js-sdk/lib/models/relations';
import { reactionViewerAtom, ReactionViewerState } from '../reactionViewer';

export const useReactionViewerState = (): ReactionViewerState | undefined =>
  useAtomValue(reactionViewerAtom);

export const useCloseReactionViewer = (): (() => void) => {
  const set = useSetAtom(reactionViewerAtom);
  return useCallback(() => set(undefined), [set]);
};

export const useOpenReactionViewer = (): ((
  room: Room,
  relations: Relations,
  initialKey?: string
) => void) => {
  const set = useSetAtom(reactionViewerAtom);
  return useCallback((room, relations, initialKey) => set({ room, relations, initialKey }), [set]);
};
