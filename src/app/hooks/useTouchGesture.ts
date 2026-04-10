import type { Dispatch, SetStateAction, TouchEventHandler } from 'react';
import { useRef } from 'react';
import type { Pan } from './usePan';

type TouchGestureState = {
  initialDistance: number;
  initialZoom: number;
  lastTouchX: number;
  lastTouchY: number;
};

type TapState = {
  time: number;
  x: number;
  y: number;
};

const getDistance = (t1: React.Touch, t2: React.Touch): number =>
  Math.hypot(t2.clientX - t1.clientX, t2.clientY - t1.clientY);

export const useTouchGesture = (
  setZoom: Dispatch<SetStateAction<number>>,
  setPan: Dispatch<SetStateAction<Pan>>,
  zoomMin = 0.1,
  zoomMax = 5
) => {
  const gestureRef = useRef<TouchGestureState | null>(null);
  const zoomRef = useRef(1);
  const lastTapRef = useRef<TapState | null>(null);
  const touchStartRef = useRef<{ x: number; y: number; time: number } | null>(null);

  // Keep zoomRef in sync via the setter pattern
  const setZoomTracked: typeof setZoom = (value) => {
    setZoom((prev) => {
      const next = typeof value === 'function' ? value(prev) : value;
      zoomRef.current = next;
      return next;
    });
  };

  const onTouchStart: TouchEventHandler = (e) => {
    if (e.touches.length === 2) {
      const dist = getDistance(e.touches[0], e.touches[1]);
      gestureRef.current = {
        initialDistance: dist,
        initialZoom: zoomRef.current,
        lastTouchX: (e.touches[0].clientX + e.touches[1].clientX) / 2,
        lastTouchY: (e.touches[0].clientY + e.touches[1].clientY) / 2,
      };
    } else if (e.touches.length === 1) {
      gestureRef.current = {
        initialDistance: 0,
        initialZoom: zoomRef.current,
        lastTouchX: e.touches[0].clientX,
        lastTouchY: e.touches[0].clientY,
      };
      touchStartRef.current = {
        x: e.touches[0].clientX,
        y: e.touches[0].clientY,
        time: Date.now(),
      };
    }
  };

  const onTouchMove: TouchEventHandler = (e) => {
    if (!gestureRef.current) return;

    if (e.touches.length === 2) {
      const newDist = getDistance(e.touches[0], e.touches[1]);
      const { initialDistance, initialZoom } = gestureRef.current;
      if (initialDistance > 0) {
        const ratio = newDist / initialDistance;
        const newZoom = Math.min(zoomMax, Math.max(zoomMin, initialZoom * ratio));
        setZoomTracked(newZoom);
      }

      // Pan with midpoint shift during pinch
      const midX = (e.touches[0].clientX + e.touches[1].clientX) / 2;
      const midY = (e.touches[0].clientY + e.touches[1].clientY) / 2;
      const dx = midX - gestureRef.current.lastTouchX;
      const dy = midY - gestureRef.current.lastTouchY;
      if (dx !== 0 || dy !== 0) {
        const z = zoomRef.current;
        setPan((p) => ({
          translateX: p.translateX + dx / z,
          translateY: p.translateY + dy / z,
        }));
      }
      gestureRef.current.lastTouchX = midX;
      gestureRef.current.lastTouchY = midY;
    } else if (e.touches.length === 1 && zoomRef.current !== 1) {
      const dx = e.touches[0].clientX - gestureRef.current.lastTouchX;
      const dy = e.touches[0].clientY - gestureRef.current.lastTouchY;
      const z = zoomRef.current;
      setPan((p) => ({
        translateX: p.translateX + dx / z,
        translateY: p.translateY + dy / z,
      }));
      gestureRef.current.lastTouchX = e.touches[0].clientX;
      gestureRef.current.lastTouchY = e.touches[0].clientY;
    }
  };

  const DOUBLE_TAP_DELAY = 300;
  const TAP_MOVE_THRESHOLD = 10;

  const onTouchEnd: TouchEventHandler = (e) => {
    if (e.touches.length === 0) {
      // Detect taps (short touch with minimal movement)
      const start = touchStartRef.current;
      if (start) {
        const now = Date.now();
        const elapsed = now - start.time;
        const ct = e.changedTouches[0];
        const dist = Math.hypot(ct.clientX - start.x, ct.clientY - start.y);

        if (elapsed < 300 && dist < TAP_MOVE_THRESHOLD) {
          const lastTap = lastTapRef.current;
          if (
            lastTap &&
            now - lastTap.time < DOUBLE_TAP_DELAY &&
            Math.hypot(ct.clientX - lastTap.x, ct.clientY - lastTap.y) < TAP_MOVE_THRESHOLD
          ) {
            // Double tap detected — prevent synthesized dblclick from also firing
            e.preventDefault();
            if (zoomRef.current === 1) {
              setZoomTracked(2);
            } else {
              setZoomTracked(1);
              setPan({ translateX: 0, translateY: 0 });
            }
            lastTapRef.current = null;
          } else {
            lastTapRef.current = { time: now, x: ct.clientX, y: ct.clientY };
          }
        }
      }
      touchStartRef.current = null;
      gestureRef.current = null;
    } else if (e.touches.length === 1) {
      // Transitioned from pinch to single finger — reset for drag
      gestureRef.current = {
        initialDistance: 0,
        initialZoom: zoomRef.current,
        lastTouchX: e.touches[0].clientX,
        lastTouchY: e.touches[0].clientY,
      };
    }
  };

  return { onTouchStart, onTouchMove, onTouchEnd };
};
