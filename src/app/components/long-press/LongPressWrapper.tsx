import type { CSSProperties, PointerEvent as ReactPointerEvent, ReactNode } from 'react';
import React, { useCallback, useRef } from 'react';

const LONG_PRESS_MS = 500;

const touchCalloutStyle: CSSProperties = {
  WebkitTouchCallout: 'none',
  userSelect: 'none',
} as CSSProperties;

type LongPressWrapperProps = {
  onLongPress: () => void;
  children: ReactNode;
};

export function LongPressWrapper({ onLongPress, children }: LongPressWrapperProps) {
  const timerRef = useRef<ReturnType<typeof setTimeout>>();
  const suppressRef = useRef(false);

  const start = useCallback(
    (e: ReactPointerEvent) => {
      if (e.button !== 0) return;
      suppressRef.current = false;
      timerRef.current = setTimeout(() => {
        suppressRef.current = true;
        onLongPress();
      }, LONG_PRESS_MS);
    },
    [onLongPress]
  );

  const cancel = useCallback(() => clearTimeout(timerRef.current), []);

  return (
    <div
      onPointerDown={start}
      onPointerUp={cancel}
      onPointerLeave={cancel}
      onPointerCancel={cancel}
      onContextMenu={(e) => e.preventDefault()}
      onClickCapture={(e) => {
        if (suppressRef.current) {
          suppressRef.current = false;
          e.stopPropagation();
          e.preventDefault();
        }
      }}
      style={touchCalloutStyle}
    >
      {children}
    </div>
  );
}
