import { useCallback, useEffect, useRef, useState } from 'react';

const EDGE_ZONE_RATIO = 1; // fraction of screen width for swipe zone
const MIN_OPEN_DISTANCE = 60; // px to trigger open
const MIN_CLOSE_DISTANCE = 30; // px to trigger close
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
  const openRef = useRef(open);
  openRef.current = open;
  const touchRef = useRef<TouchState | null>(null);

  const handleTouchStart = useCallback((e: TouchEvent) => {
    const target = e.target as Element | null;
    if (target?.closest?.('[data-overlay]')) return;

    const touch = e.touches[0];
    const inEdgeZone = touch.clientX < window.innerWidth * EDGE_ZONE_RATIO;

    if (!openRef.current && !inEdgeZone) return;

    touchRef.current = {
      startX: touch.clientX,
      startY: touch.clientY,
      currentX: touch.clientX,
      tracking: true,
      directionLocked: false,
      isHorizontal: false,
    };
  }, []);

  const handleTouchMove = useCallback((e: TouchEvent) => {
    const state = touchRef.current;
    if (!state || !state.tracking) return;

    const touch = e.touches[0];
    const dx = touch.clientX - state.startX;
    const dy = touch.clientY - state.startY;

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

    if (openRef.current) {
      const offset = Math.max(0, Math.min(DRAWER_WIDTH, DRAWER_WIDTH + dx));
      setDragOffset(offset);
    } else {
      const offset = Math.max(0, Math.min(DRAWER_WIDTH, dx));
      setDragOffset(offset);
    }
  }, []);

  const handleTouchEnd = useCallback(() => {
    const state = touchRef.current;
    if (!state || !state.tracking) {
      touchRef.current = null;
      return;
    }

    const dx = state.currentX - state.startX;

    if (openRef.current) {
      if (dx < -MIN_CLOSE_DISTANCE) {
        setOpen(false);
      }
    } else if (dx > MIN_OPEN_DISTANCE) {
      setOpen(true);
    }

    setDragOffset(null);
    touchRef.current = null;
  }, []);

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
