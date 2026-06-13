import { useCallback, useLayoutEffect, useRef } from 'react';

export const useEvent = <TArgs extends unknown[], TReturn>(
  handler: (...args: TArgs) => TReturn
): ((...args: TArgs) => TReturn) => {
  const ref = useRef(handler);
  useLayoutEffect(() => {
    ref.current = handler;
  });
  return useCallback((...args: TArgs) => ref.current(...args), []);
};
