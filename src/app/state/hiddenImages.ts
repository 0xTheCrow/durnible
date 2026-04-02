import { atom } from 'jotai';
import { createContext } from 'react';

export const hiddenImagesAtom = atom<Set<string>>(new Set<string>());

export const MessageEventIdContext = createContext<string>('');
