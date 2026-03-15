import { atom } from 'jotai';

export type ImageViewerData = {
  src: string;
  alt: string;
};

export const imageViewerAtom = atom<ImageViewerData | undefined>(undefined);
