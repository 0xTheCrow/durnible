import type { CSSProperties, MouseEvent, PointerEvent } from 'react';
import { useRef } from 'react';

const LONG_PRESS_MS = 500;

const touchCalloutStyle: CSSProperties = {
  WebkitTouchCallout: 'none',
  userSelect: 'none',
} as CSSProperties;

export type LongPressPosition = {
  x: number;
  y: number;
};

export const useLongPress = (onLongPress: (position: LongPressPosition) => void) => {
  const longPressTimeoutRef = useRef<ReturnType<typeof setTimeout>>();
  const isClickAfterLongPressRef = useRef(false);

  const cancelLongPress = () => clearTimeout(longPressTimeoutRef.current);

  return {
    onPointerDown: (evt: PointerEvent) => {
      if (evt.pointerType !== 'touch' || evt.button !== 0) return;
      isClickAfterLongPressRef.current = false;
      const position = { x: evt.clientX, y: evt.clientY };
      longPressTimeoutRef.current = setTimeout(() => {
        isClickAfterLongPressRef.current = true;
        onLongPress(position);
      }, LONG_PRESS_MS);
    },
    onPointerUp: cancelLongPress,
    onPointerLeave: cancelLongPress,
    onPointerCancel: cancelLongPress,
    onContextMenu: (evt: MouseEvent) => evt.preventDefault(),
    onClickCapture: (evt: MouseEvent) => {
      if (!isClickAfterLongPressRef.current) return;
      isClickAfterLongPressRef.current = false;
      evt.stopPropagation();
      evt.preventDefault();
    },
    style: touchCalloutStyle,
  };
};
