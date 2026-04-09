import React from 'react';
import { renderHook, act, fireEvent } from '@testing-library/react';
import { describe, it, expect, afterEach } from 'vitest';
import { usePan } from './usePan';

// Clean up any lingering document listeners between tests
afterEach(() => {
  fireEvent.mouseUp(document);
});

const fakeMouseDown = (preventDefault = () => {}) =>
  ({ preventDefault } as unknown as React.MouseEvent<HTMLElement>);

describe('usePan', () => {
  it('initializes pan at (0, 0)', () => {
    const { result } = renderHook(() => usePan(false));
    expect(result.current.pan).toEqual({ translateX: 0, translateY: 0 });
  });

  it('cursor is "initial" when not active', () => {
    const { result } = renderHook(() => usePan(false));
    expect(result.current.cursor).toBe('initial');
  });

  it('cursor is "grab" when active', () => {
    const { result } = renderHook(() => usePan(true));
    expect(result.current.cursor).toBe('grab');
  });

  it('cursor updates when active changes', () => {
    const { result, rerender } = renderHook(({ active }) => usePan(active), {
      initialProps: { active: false },
    });
    expect(result.current.cursor).toBe('initial');
    rerender({ active: true });
    expect(result.current.cursor).toBe('grab');
    rerender({ active: false });
    expect(result.current.cursor).toBe('initial');
  });

  it('pan resets to (0, 0) when active becomes false', () => {
    const { result, rerender } = renderHook(({ active }) => usePan(active), {
      initialProps: { active: true },
    });
    act(() => result.current.setPan({ translateX: 50, translateY: 50 }));
    expect(result.current.pan).toEqual({ translateX: 50, translateY: 50 });
    rerender({ active: false });
    expect(result.current.pan).toEqual({ translateX: 0, translateY: 0 });
  });

  it('does not pan when inactive', () => {
    const { result } = renderHook(() => usePan(false, 1));
    act(() => result.current.onMouseDown(fakeMouseDown()));
    act(() => fireEvent.mouseMove(document, { movementX: 10, movementY: 20 }));
    expect(result.current.pan).toEqual({ translateX: 0, translateY: 0 });
  });

  it('sets cursor to "grabbing" on mousedown', () => {
    const { result } = renderHook(() => usePan(true, 1));
    act(() => result.current.onMouseDown(fakeMouseDown()));
    expect(result.current.cursor).toBe('grabbing');
  });

  it('pans on mousemove after mousedown', () => {
    const { result } = renderHook(() => usePan(true, 1));
    act(() => result.current.onMouseDown(fakeMouseDown()));
    act(() => fireEvent.mouseMove(document, { movementX: 10, movementY: 20 }));
    expect(result.current.pan).toEqual({ translateX: 10, translateY: 20 });
  });

  it('accumulates pan across multiple mousemove events', () => {
    const { result } = renderHook(() => usePan(true, 1));
    act(() => result.current.onMouseDown(fakeMouseDown()));
    act(() => fireEvent.mouseMove(document, { movementX: 10, movementY: 5 }));
    act(() => fireEvent.mouseMove(document, { movementX: 5, movementY: 10 }));
    expect(result.current.pan).toEqual({ translateX: 15, translateY: 15 });
  });

  it('divides pan movement by zoom level', () => {
    const { result } = renderHook(() => usePan(true, 2));
    act(() => result.current.onMouseDown(fakeMouseDown()));
    act(() => fireEvent.mouseMove(document, { movementX: 20, movementY: 40 }));
    expect(result.current.pan).toEqual({ translateX: 10, translateY: 20 });
  });

  it('sets cursor back to "grab" on mouseup', () => {
    const { result } = renderHook(() => usePan(true, 1));
    act(() => result.current.onMouseDown(fakeMouseDown()));
    expect(result.current.cursor).toBe('grabbing');
    act(() => fireEvent.mouseUp(document));
    expect(result.current.cursor).toBe('grab');
  });

  it('stops panning after mouseup', () => {
    const { result } = renderHook(() => usePan(true, 1));
    act(() => result.current.onMouseDown(fakeMouseDown()));
    act(() => fireEvent.mouseMove(document, { movementX: 10, movementY: 10 }));
    act(() => fireEvent.mouseUp(document));
    act(() => fireEvent.mouseMove(document, { movementX: 50, movementY: 50 }));
    expect(result.current.pan).toEqual({ translateX: 10, translateY: 10 });
  });
});
