import type { ReactNode } from 'react';
import React from 'react';
import { useLongPress } from '../../hooks/gesture/useLongPress';

type LongPressWrapperProps = {
  onLongPress: () => void;
  children: ReactNode;
};

export function LongPressWrapper({ onLongPress, children }: LongPressWrapperProps) {
  const longPressProps = useLongPress(onLongPress);

  return <div {...longPressProps}>{children}</div>;
}
