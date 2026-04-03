import { atom } from 'jotai';
import { createContext } from 'react';

const MAX_HIDDEN = 200;
const STORAGE_KEY = 'cinny_hidden_images';

const loadFromStorage = (): string[] => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
};

const saveToStorage = (queue: string[]): void => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(queue));
  } catch {
    // ignore quota/security errors
  }
};

// Underlying atom holds the queue ordered oldest→newest
const hiddenImagesQueueAtom = atom<string[]>(loadFromStorage());

// Public atom: reads as a Set for O(1) lookup, writes via the same updater
// signature consumers already use. On add: moves item to the end (most recent)
// and evicts from the front when over MAX_HIDDEN. On remove: drops the item.
export const hiddenImagesAtom = atom(
  (get): Set<string> => new Set(get(hiddenImagesQueueAtom)),
  (get, set, update: Set<string> | ((prev: Set<string>) => Set<string>)) => {
    const currentQueue = get(hiddenImagesQueueAtom);
    const currentSet = new Set(currentQueue);
    const nextSet = typeof update === 'function' ? update(currentSet) : update;

    // Keep existing entries in their original order, then append new ones at the end
    let nextQueue = currentQueue.filter((id) => nextSet.has(id));
    for (const id of nextSet) {
      if (!currentSet.has(id)) nextQueue.push(id);
    }

    // Evict oldest entries when over the limit
    if (nextQueue.length > MAX_HIDDEN) {
      nextQueue = nextQueue.slice(nextQueue.length - MAX_HIDDEN);
    }

    saveToStorage(nextQueue);
    set(hiddenImagesQueueAtom, nextQueue);
  }
);

export const MessageEventIdContext = createContext<string>('');
