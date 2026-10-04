import type { TouchEvent as ReactTouchEvent } from 'react';
import { useRef, useState } from 'react';

const DIRECTION_LOCK_DISTANCE = 10;
const DISMISS_DISTANCE = 80;

type SwipeTouchState = {
  startX: number;
  startY: number;
  offsetY: number;
  isDirectionLocked: boolean;
  isVertical: boolean;
};

export type SwipeDownDismiss = {
  dragOffset: number | undefined;
  onTouchStart: (event: ReactTouchEvent) => void;
  onTouchMove: (event: ReactTouchEvent) => void;
  onTouchEnd: () => void;
};

export const useSwipeDownDismiss = (
  onDismiss: () => void,
  isEnabled: boolean
): SwipeDownDismiss => {
  const [dragOffset, setDragOffset] = useState<number>();
  const touchRef = useRef<SwipeTouchState>();

  const onTouchStart = (event: ReactTouchEvent) => {
    if (!isEnabled || event.touches.length !== 1) return;
    const touch = event.touches[0];
    touchRef.current = {
      startX: touch.clientX,
      startY: touch.clientY,
      offsetY: 0,
      isDirectionLocked: false,
      isVertical: false,
    };
  };

  const onTouchMove = (event: ReactTouchEvent) => {
    const touchState = touchRef.current;
    if (!touchState) return;

    const touch = event.touches[0];
    const dx = touch.clientX - touchState.startX;
    const dy = touch.clientY - touchState.startY;

    if (!touchState.isDirectionLocked) {
      if (Math.abs(dx) < DIRECTION_LOCK_DISTANCE && Math.abs(dy) < DIRECTION_LOCK_DISTANCE) return;
      touchState.isDirectionLocked = true;
      touchState.isVertical = Math.abs(dy) > Math.abs(dx);
      if (!touchState.isVertical) {
        touchRef.current = undefined;
        return;
      }
    }

    touchState.offsetY = Math.max(0, dy);
    setDragOffset(touchState.offsetY);
  };

  const onTouchEnd = () => {
    const touchState = touchRef.current;
    touchRef.current = undefined;
    setDragOffset(undefined);
    if (touchState && touchState.offsetY > DISMISS_DISTANCE) onDismiss();
  };

  return { dragOffset, onTouchStart, onTouchMove, onTouchEnd };
};
