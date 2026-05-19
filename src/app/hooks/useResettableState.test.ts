import { renderHook, act } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { useResettableState } from './useResettableState';

describe('useResettableState', () => {
  it('returns the initial value', () => {
    const { result } = renderHook(() => useResettableState('hello'));
    expect(result.current[0]).toBe('hello');
  });

  it('applies transform on initial render', () => {
    const { result } = renderHook(() =>
      useResettableState<string | undefined, string>(undefined, (v) => v ?? 'fallback')
    );
    expect(result.current[0]).toBe('fallback');
  });

  it('local state diverges via setter', () => {
    const { result } = renderHook(() => useResettableState('original'));

    act(() => {
      result.current[1]('edited');
    });

    expect(result.current[0]).toBe('edited');
  });

  it('resets when prop changes', () => {
    const { result, rerender } = renderHook(
      ({ prop }: { prop: string }) => useResettableState(prop),
      {
        initialProps: { prop: 'first' },
      }
    );

    act(() => {
      result.current[1]('edited');
    });
    expect(result.current[0]).toBe('edited');

    rerender({ prop: 'second' });
    expect(result.current[0]).toBe('second');
  });

  it('applies transform on reset', () => {
    const { result, rerender } = renderHook(
      ({ prop }: { prop: string | undefined }) => useResettableState(prop, (v) => v ?? 'default'),
      { initialProps: { prop: 'initial' as string | undefined } }
    );

    expect(result.current[0]).toBe('initial');

    rerender({ prop: undefined });
    expect(result.current[0]).toBe('default');
  });

  it('does not reset when prop is the same', () => {
    const { result, rerender } = renderHook(
      ({ prop }: { prop: string }) => useResettableState(prop),
      { initialProps: { prop: 'stable' } }
    );

    act(() => {
      result.current[1]('edited');
    });
    expect(result.current[0]).toBe('edited');

    rerender({ prop: 'stable' });
    expect(result.current[0]).toBe('edited');
  });
});
