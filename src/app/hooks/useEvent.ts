import { useCallback, useLayoutEffect, useRef } from 'react';

// Stable-identity callback that always reads the latest closure values.
// Use when a callback needs to be a stable dependency for effects/observers
// without freezing the closure.
export const useEvent = <TArgs extends unknown[], TReturn>(
  handler: (...args: TArgs) => TReturn
): ((...args: TArgs) => TReturn) => {
  const ref = useRef(handler);
  useLayoutEffect(() => {
    ref.current = handler;
  });
  return useCallback((...args: TArgs) => ref.current(...args), []);
};
