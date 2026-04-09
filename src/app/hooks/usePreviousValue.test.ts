import { renderHook } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { usePreviousValue } from './usePreviousValue';

describe('usePreviousValue', () => {
  it('returns the initial value on the first render', () => {
    const { result } = renderHook(() => usePreviousValue('current', 'initial'));
    expect(result.current).toBe('initial');
  });

  it('returns the previous value after an update', () => {
    let value = 'first';
    const { result, rerender } = renderHook(() => usePreviousValue(value, 'initial'));

    value = 'second';
    rerender();

    expect(result.current).toBe('first');
  });

  it('lags one render behind', () => {
    let value = 'a';
    const { result, rerender } = renderHook(() => usePreviousValue(value, 'init'));

    value = 'b';
    rerender();
    expect(result.current).toBe('a');

    value = 'c';
    rerender();
    expect(result.current).toBe('b');
  });
});
