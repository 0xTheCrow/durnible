import { atom } from 'jotai';

export type FileDropOverride = {
  title: string;
  description?: string;
  onDrop: (files: File[]) => void;
};

export const fileDropOverrideAtom = atom<FileDropOverride | undefined>(undefined);
