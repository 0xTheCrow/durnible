import { useSyncExternalStore } from 'react';

const subscribe = (callback: () => void) => {
  const vv = window.visualViewport;
  if (!vv) return () => {};
  vv.addEventListener('resize', callback);
  return () => vv.removeEventListener('resize', callback);
};

const getSnapshot = () => window.visualViewport?.height ?? window.innerHeight;

const getServerSnapshot = () => 0;

export const useVisualViewportHeight = (): number =>
  useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
