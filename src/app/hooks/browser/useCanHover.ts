import { useSyncExternalStore } from 'react';

const QUERY = '(hover: hover)';

const subscribe = (callback: () => void) => {
  const mediaQueryList = window.matchMedia(QUERY);
  mediaQueryList.addEventListener('change', callback);
  return () => mediaQueryList.removeEventListener('change', callback);
};

const getSnapshot = () => window.matchMedia(QUERY).matches;

const getServerSnapshot = () => true;

export const useCanHover = (): boolean =>
  useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
