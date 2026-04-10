import { useCallback } from 'react';
import { useAtomValue, useSetAtom } from 'jotai';
import type { Room } from 'matrix-js-sdk';
import type { Relations } from 'matrix-js-sdk/lib/models/relations';
import type { ReactionViewerState } from '../reactionViewer';
import { reactionViewerAtom } from '../reactionViewer';

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
