import { atom } from 'jotai';

export const selectionModeAtom = atom(false);
export const selectedIdsAtom = atom<Set<string>>(new Set<string>());
