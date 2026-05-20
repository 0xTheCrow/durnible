import { atom } from 'jotai';

export type GifUploadFormState = {
  file: File | null;
  tags: string;
  isPrivate: boolean;
  nsfw: boolean;
};

export const gifUploadFormInitialState: GifUploadFormState = {
  file: null,
  tags: '',
  isPrivate: false,
  nsfw: false,
};

export const gifUploadFormAtom = atom<GifUploadFormState>(gifUploadFormInitialState);
