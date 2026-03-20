import { useCallback, useEffect, useRef, useState } from 'react';

const EDGE_ZONE = 30; // px from left edge to start swipe
const MIN_SWIPE_DISTANCE = 60; // px to trigger open/close
const DRAWER_WIDTH = 280; // px

type TouchState = {
  startX: number;
  startY: number;
  currentX: number;
  tracking: boolean;
  directionLocked: boolean;
  isHorizontal: boolean;
};

export function useSwipeDrawer() {
  const [open, setOpen] = useState(false);
  const [dragOffset, setDragOffset] = useState<number | null>(null);
  const touchRef = useRef<TouchState | null>(null);

  const handleTouchStart = useCallback(
    (e: TouchEvent) => {
      const touch = e.touches[0];
      const inEdgeZone = touch.clientX < EDGE_ZONE;

      if (!open && !inEdgeZone) return;

      touchRef.current = {
        startX: touch.clientX,
        startY: touch.clientY,
        currentX: touch.clientX,
        tracking: true,
        directionLocked: false,
        isHorizontal: false,
      };
    },
    [open]
  );

  const handleTouchMove = useCallback(
    (e: TouchEvent) => {
      const state = touchRef.current;
      if (!state || !state.tracking) return;

      const touch = e.touches[0];
      const dx = touch.clientX - state.startX;
      const dy = touch.clientY - state.startY;

      // Lock direction after enough movement
      if (!state.directionLocked && (Math.abs(dx) > 10 || Math.abs(dy) > 10)) {
        state.directionLocked = true;
        state.isHorizontal = Math.abs(dx) > Math.abs(dy);
        if (!state.isHorizontal) {
          state.tracking = false;
          setDragOffset(null);
          return;
        }
      }

      if (!state.directionLocked) return;

      state.currentX = touch.clientX;

      if (open) {
        // Closing: clamp between 0 and DRAWER_WIDTH
        const offset = Math.max(0, Math.min(DRAWER_WIDTH, DRAWER_WIDTH + dx));
        setDragOffset(offset);
      } else {
        // Opening: clamp between 0 and DRAWER_WIDTH
        const offset = Math.max(0, Math.min(DRAWER_WIDTH, dx));
        setDragOffset(offset);
      }
    },
    [open]
  );

  const handleTouchEnd = useCallback(() => {
    const state = touchRef.current;
    if (!state || !state.tracking) {
      touchRef.current = null;
      return;
    }

    const dx = state.currentX - state.startX;

    if (open) {
      // Close if swiped left far enough
      if (dx < -MIN_SWIPE_DISTANCE) {
        setOpen(false);
      }
    } else {
      // Open if swiped right far enough
      if (dx > MIN_SWIPE_DISTANCE) {
        setOpen(true);
      }
    }

    setDragOffset(null);
    touchRef.current = null;
  }, [open]);

  useEffect(() => {
    document.addEventListener('touchstart', handleTouchStart, { passive: true });
    document.addEventListener('touchmove', handleTouchMove, { passive: true });
    document.addEventListener('touchend', handleTouchEnd, { passive: true });

    return () => {
      document.removeEventListener('touchstart', handleTouchStart);
      document.removeEventListener('touchmove', handleTouchMove);
      document.removeEventListener('touchend', handleTouchEnd);
    };
  }, [handleTouchStart, handleTouchMove, handleTouchEnd]);

  return { open, setOpen, dragOffset, drawerWidth: DRAWER_WIDTH };
}
