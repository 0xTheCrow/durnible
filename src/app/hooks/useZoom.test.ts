import { renderHook, act } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { useZoom } from './useZoom';

describe('useZoom', () => {
  it('initializes zoom at 1', () => {
    const { result } = renderHook(() => useZoom(0.2));
    expect(result.current.zoom).toBe(1);
  });

  it('zoomIn increases zoom by step', () => {
    const { result } = renderHook(() => useZoom(0.2));
    act(() => result.current.zoomIn());
    expect(result.current.zoom).toBeCloseTo(1.2);
  });

  it('zoomOut decreases zoom by step', () => {
    const { result } = renderHook(() => useZoom(0.2));
    act(() => result.current.zoomOut());
    expect(result.current.zoom).toBeCloseTo(0.8);
  });

  it('zoomIn does not exceed max', () => {
    const { result } = renderHook(() => useZoom(1, 0.1, 5));
    act(() => result.current.setZoom(5));
    act(() => result.current.zoomIn());
    expect(result.current.zoom).toBe(5);
  });

  it('zoomOut does not go below min', () => {
    const { result } = renderHook(() => useZoom(1, 0.1, 5));
    act(() => result.current.setZoom(0.1));
    act(() => result.current.zoomOut());
    expect(result.current.zoom).toBe(0.1);
  });

  it('setZoom sets zoom to a specific value', () => {
    const { result } = renderHook(() => useZoom(0.2));
    act(() => result.current.setZoom(3));
    expect(result.current.zoom).toBe(3);
  });

  it('onWheel zooms in when scrolling up (deltaY < 0)', () => {
    const { result } = renderHook(() => useZoom(0.2));
    act(() => {
      result.current.onWheel({ deltaY: -1, preventDefault: () => {} } as React.WheelEvent);
    });
    expect(result.current.zoom).toBeCloseTo(1.25);
  });

  it('onWheel zooms out when scrolling down (deltaY > 0)', () => {
    const { result } = renderHook(() => useZoom(0.2));
    act(() => {
      result.current.onWheel({ deltaY: 1, preventDefault: () => {} } as React.WheelEvent);
    });
    expect(result.current.zoom).toBeCloseTo(0.75);
  });

  it('onWheel clamps to min', () => {
    const { result } = renderHook(() => useZoom(0.2, 0.1, 5));
    act(() => result.current.setZoom(0.1));
    act(() => {
      result.current.onWheel({ deltaY: 1, preventDefault: () => {} } as React.WheelEvent);
    });
    expect(result.current.zoom).toBe(0.1);
  });

  it('onWheel clamps to max', () => {
    const { result } = renderHook(() => useZoom(0.2, 0.1, 5));
    act(() => result.current.setZoom(5));
    act(() => {
      result.current.onWheel({ deltaY: -1, preventDefault: () => {} } as React.WheelEvent);
    });
    expect(result.current.zoom).toBe(5);
  });
});
