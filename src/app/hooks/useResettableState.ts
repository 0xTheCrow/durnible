import { useState } from 'react';

export function useResettableState<P, S = P>(
  propValue: P,
  transform?: (p: P) => S
): [S, React.Dispatch<React.SetStateAction<S>>] {
  const derive = transform ?? ((p: P) => p as unknown as S);
  const [value, setValue] = useState(() => derive(propValue));
  const [prev, setPrev] = useState(propValue);
  if (propValue !== prev) {
    setPrev(propValue);
    setValue(derive(propValue));
  }
  return [value, setValue];
}
