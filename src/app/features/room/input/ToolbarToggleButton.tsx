import { Icon, IconButton, Icons } from 'folds';
import type {
  CSSProperties,
  MouseEvent as ReactMouseEvent,
  PointerEvent as ReactPointerEvent,
} from 'react';
import React, { useCallback, useRef } from 'react';
import { useSetting } from '../../../state/hooks/settings';
import { settingsAtom } from '../../../state/settings';

export const LONG_PRESS_MS = 500;
export const DOUBLE_TAP_MS = 300;

const touchCalloutStyle: CSSProperties = {
  WebkitTouchCallout: 'none',
  userSelect: 'none',
} as CSSProperties;

type ToolbarToggleButtonProps = {
  toolbar: boolean;
  onToggle: () => void;
};

export function ToolbarToggleButton({ toolbar, onToggle }: ToolbarToggleButtonProps) {
  const [isGestureRequired] = useSetting(settingsAtom, 'isEditorToolbarGestureRequired');

  const longPressTimerRef = useRef<ReturnType<typeof setTimeout>>();
  const isLongPressedRef = useRef(false);
  const isTouchPointerRef = useRef(false);
  const lastTapAtRef = useRef(0);

  const cancelLongPress = useCallback(() => clearTimeout(longPressTimerRef.current), []);

  const handlePointerDown = (evt: ReactPointerEvent) => {
    isTouchPointerRef.current = evt.pointerType === 'touch';
    isLongPressedRef.current = false;
    if (!isGestureRequired || !isTouchPointerRef.current) return;
    longPressTimerRef.current = setTimeout(() => {
      isLongPressedRef.current = true;
      onToggle();
    }, LONG_PRESS_MS);
  };

  const handleClick = () => {
    if (!isGestureRequired || !isTouchPointerRef.current) {
      onToggle();
      return;
    }
    if (isLongPressedRef.current) return;

    const now = Date.now();
    if (now - lastTapAtRef.current <= DOUBLE_TAP_MS) {
      lastTapAtRef.current = 0;
      onToggle();
      return;
    }
    lastTapAtRef.current = now;
  };

  return (
    <IconButton
      variant="SurfaceVariant"
      size="300"
      radii="300"
      aria-pressed={toolbar}
      onMouseDown={(evt: ReactMouseEvent) => evt.preventDefault()}
      onPointerDown={handlePointerDown}
      onPointerUp={cancelLongPress}
      onPointerLeave={cancelLongPress}
      onPointerCancel={cancelLongPress}
      onContextMenu={isGestureRequired ? (evt: ReactMouseEvent) => evt.preventDefault() : undefined}
      onClick={handleClick}
      data-testid="room-input-toolbar-toggle"
      style={isGestureRequired ? touchCalloutStyle : undefined}
    >
      <Icon src={toolbar ? Icons.AlphabetUnderline : Icons.Alphabet} />
    </IconButton>
  );
}
