import React from 'react';
import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { useTouchGesture } from './useTouchGesture';

// Helpers for constructing fake touch events
const mockTouchList = (points: { clientX: number; clientY: number }[]) =>
  Object.assign([...points], {
    length: points.length,
    item: (i: number) => points[i],
  }) as unknown as React.TouchList;

const mockTouchEvent = (
  touches: { clientX: number; clientY: number }[],
  changedTouches: { clientX: number; clientY: number }[] = []
) =>
  ({
    touches: mockTouchList(touches),
    changedTouches: mockTouchList(changedTouches),
    preventDefault: vi.fn(),
  } as unknown as React.TouchEvent);

// Renders the hook with its own real zoom/pan state so zoomRef stays in sync
const renderGesture = () =>
  renderHook(() => {
    const [zoom, setZoom] = React.useState(1);
    const [pan, setPan] = React.useState({ translateX: 0, translateY: 0 });
    const handlers = useTouchGesture(setZoom, setPan);
    return { zoom, pan, ...handlers };
  });

// Simulate a complete tap: touchstart → touchend
const tap = (result: ReturnType<typeof renderGesture>['result'], x = 100, y = 100) => {
  result.current.onTouchStart(mockTouchEvent([{ clientX: x, clientY: y }]));
  const endEvent = mockTouchEvent([], [{ clientX: x, clientY: y }]);
  result.current.onTouchEnd(endEvent);
  return endEvent;
};

describe('useTouchGesture', () => {
  describe('single-finger drag', () => {
    it('does not pan when zoom is 1', () => {
      const { result } = renderGesture();
      act(() => {
        result.current.onTouchStart(mockTouchEvent([{ clientX: 0, clientY: 0 }]));
        result.current.onTouchMove(mockTouchEvent([{ clientX: 30, clientY: 40 }]));
      });
      expect(result.current.pan).toEqual({ translateX: 0, translateY: 0 });
    });

    it('pans when zoomed in', () => {
      const { result } = renderGesture();
      act(() => result.current.onTouchStart(mockTouchEvent([{ clientX: 0, clientY: 0 }])));
      // Force zoom > 1
      act(() => {
        // two-finger pinch to zoom in
        result.current.onTouchStart(
          mockTouchEvent([
            { clientX: 0, clientY: 0 },
            { clientX: 100, clientY: 0 },
          ])
        );
        result.current.onTouchMove(
          mockTouchEvent([
            { clientX: 0, clientY: 0 },
            { clientX: 200, clientY: 0 },
          ])
        );
      });
      // Now single-finger drag
      act(() => {
        result.current.onTouchStart(mockTouchEvent([{ clientX: 100, clientY: 100 }]));
        result.current.onTouchMove(mockTouchEvent([{ clientX: 130, clientY: 150 }]));
      });
      expect(result.current.pan.translateX).not.toBe(0);
      expect(result.current.pan.translateY).not.toBe(0);
    });

    it('pan movement is divided by zoom level', () => {
      const { result } = renderGesture();
      // Pinch to exactly zoom 2
      act(() => {
        result.current.onTouchStart(
          mockTouchEvent([
            { clientX: 0, clientY: 0 },
            { clientX: 100, clientY: 0 },
          ])
        );
        result.current.onTouchMove(
          mockTouchEvent([
            { clientX: 0, clientY: 0 },
            { clientX: 200, clientY: 0 },
          ])
        );
      });
      const panBeforeDrag = result.current.pan.translateX;

      act(() => {
        result.current.onTouchStart(mockTouchEvent([{ clientX: 0, clientY: 0 }]));
        result.current.onTouchMove(mockTouchEvent([{ clientX: 100, clientY: 0 }]));
      });
      // dx=100, divided by zoom (2) = 50 added to existing pan
      expect(result.current.pan.translateX - panBeforeDrag).toBeCloseTo(50);
    });
  });

  describe('pinch-to-zoom', () => {
    it('zooms in when fingers spread apart', () => {
      const { result } = renderGesture();
      act(() => {
        result.current.onTouchStart(
          mockTouchEvent([
            { clientX: 0, clientY: 0 },
            { clientX: 100, clientY: 0 },
          ])
        );
        result.current.onTouchMove(
          mockTouchEvent([
            { clientX: 0, clientY: 0 },
            { clientX: 200, clientY: 0 },
          ])
        );
      });
      expect(result.current.zoom).toBeCloseTo(2);
    });

    it('zooms out when fingers pinch together', () => {
      const { result } = renderGesture();
      act(() => {
        result.current.onTouchStart(
          mockTouchEvent([
            { clientX: 0, clientY: 0 },
            { clientX: 200, clientY: 0 },
          ])
        );
        result.current.onTouchMove(
          mockTouchEvent([
            { clientX: 0, clientY: 0 },
            { clientX: 100, clientY: 0 },
          ])
        );
      });
      expect(result.current.zoom).toBeCloseTo(0.5);
    });

    it('clamps zoom to min (0.1)', () => {
      const { result } = renderGesture();
      act(() => {
        result.current.onTouchStart(
          mockTouchEvent([
            { clientX: 0, clientY: 0 },
            { clientX: 1000, clientY: 0 },
          ])
        );
        result.current.onTouchMove(
          mockTouchEvent([
            { clientX: 0, clientY: 0 },
            { clientX: 1, clientY: 0 },
          ])
        );
      });
      expect(result.current.zoom).toBeGreaterThanOrEqual(0.1);
    });

    it('clamps zoom to max (5)', () => {
      const { result } = renderGesture();
      act(() => {
        result.current.onTouchStart(
          mockTouchEvent([
            { clientX: 0, clientY: 0 },
            { clientX: 1, clientY: 0 },
          ])
        );
        result.current.onTouchMove(
          mockTouchEvent([
            { clientX: 0, clientY: 0 },
            { clientX: 10000, clientY: 0 },
          ])
        );
      });
      expect(result.current.zoom).toBeLessThanOrEqual(5);
    });
  });

  describe('double-tap', () => {
    it('zooms from 1 to 2 on double-tap', () => {
      const { result } = renderGesture();
      act(() => {
        tap(result);
        tap(result);
      });
      expect(result.current.zoom).toBe(2);
    });

    it('resets zoom to 1 and clears pan on double-tap when zoomed', () => {
      const { result } = renderGesture();
      // First double-tap to zoom in
      act(() => {
        tap(result);
        tap(result);
      });
      // Second double-tap to zoom out
      act(() => {
        tap(result);
        tap(result);
      });
      expect(result.current.zoom).toBe(1);
      expect(result.current.pan).toEqual({ translateX: 0, translateY: 0 });
    });

    it('calls preventDefault on the second touchend to block synthesized dblclick (zoom in)', () => {
      const { result } = renderGesture();
      let secondEndEvent!: React.TouchEvent;
      act(() => {
        tap(result);
        secondEndEvent = mockTouchEvent([], [{ clientX: 100, clientY: 100 }]);
        result.current.onTouchStart(mockTouchEvent([{ clientX: 100, clientY: 100 }]));
        result.current.onTouchEnd(secondEndEvent);
      });
      expect(secondEndEvent.preventDefault).toHaveBeenCalled();
      expect(result.current.zoom).toBe(2);
    });

    it('calls preventDefault on the second touchend to block synthesized dblclick (zoom out)', () => {
      const { result } = renderGesture();
      // First double-tap to zoom in
      act(() => {
        tap(result);
        tap(result);
      });
      expect(result.current.zoom).toBe(2);

      // Second double-tap to zoom out
      let secondEndEvent!: React.TouchEvent;
      act(() => {
        tap(result); // first tap of zoom-out sequence
        secondEndEvent = mockTouchEvent([], [{ clientX: 100, clientY: 100 }]);
        result.current.onTouchStart(mockTouchEvent([{ clientX: 100, clientY: 100 }]));
        result.current.onTouchEnd(secondEndEvent);
      });
      expect(secondEndEvent.preventDefault).toHaveBeenCalled();
      expect(result.current.zoom).toBe(1);
    });

    it('does not call preventDefault on a single tap', () => {
      const { result } = renderGesture();
      let endEvent!: React.TouchEvent;
      act(() => {
        endEvent = mockTouchEvent([], [{ clientX: 100, clientY: 100 }]);
        result.current.onTouchStart(mockTouchEvent([{ clientX: 100, clientY: 100 }]));
        result.current.onTouchEnd(endEvent);
      });
      expect(endEvent.preventDefault).not.toHaveBeenCalled();
      expect(result.current.zoom).toBe(1);
    });

    it('does not trigger when taps are far apart', () => {
      const { result } = renderGesture();
      act(() => {
        tap(result, 100, 100);
        tap(result, 200, 200); // > 10px away
      });
      expect(result.current.zoom).toBe(1);
    });

    describe('timing boundary (DOUBLE_TAP_DELAY = 300ms)', () => {
      beforeEach(() => {
        vi.useFakeTimers();
      });
      afterEach(() => {
        vi.useRealTimers();
      });

      it('detects double-tap when second tap is 299ms after first', () => {
        const { result } = renderGesture();
        act(() => tap(result));
        act(() => vi.advanceTimersByTime(299));
        act(() => tap(result));
        expect(result.current.zoom).toBe(2);
      });

      it('does not detect double-tap when second tap is exactly 300ms after first', () => {
        const { result } = renderGesture();
        act(() => tap(result));
        act(() => vi.advanceTimersByTime(300));
        act(() => tap(result));
        expect(result.current.zoom).toBe(1);
      });

      it('does not detect double-tap when second tap is 301ms after first', () => {
        const { result } = renderGesture();
        act(() => tap(result));
        act(() => vi.advanceTimersByTime(301));
        act(() => tap(result));
        expect(result.current.zoom).toBe(1);
      });

      it('a slow first tap (held > 300ms) does not count toward double-tap timing', () => {
        // If the user holds the first tap for 400ms (not a tap), it should not
        // set lastTapRef. A quick second tap should be treated as the first of
        // a new potential double-tap, not the second.
        const { result } = renderGesture();
        act(() => {
          result.current.onTouchStart(mockTouchEvent([{ clientX: 100, clientY: 100 }]));
        });
        act(() => vi.advanceTimersByTime(400)); // hold too long — not a tap
        act(() => {
          result.current.onTouchEnd(mockTouchEvent([], [{ clientX: 100, clientY: 100 }]));
        });
        // Now a quick double-tap shouldn't fire because lastTapRef was never set
        act(() => tap(result));
        act(() => tap(result));
        expect(result.current.zoom).toBe(2); // second pair IS a valid double-tap
      });
    });
  });
});
