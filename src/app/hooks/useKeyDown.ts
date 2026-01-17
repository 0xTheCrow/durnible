import { useEffect } from 'react';

export const useKeyDown = (
  target: EventTarget | null,
  callback: (evt: KeyboardEvent) => void,
  options?: AddEventListenerOptions
) => {
  useEffect(() => {
    if (!target) return undefined;
    target.addEventListener('keydown', callback, options);
    return () => {
      target.removeEventListener('keydown', callback, options);
    };
  }, [target, callback, options]);
};
