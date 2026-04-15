import { renderHook, act } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { useAsyncSearch } from './useAsyncSearch';

type Item = { name: string };

const getItemStr = (item: Item) => item.name;

describe('useAsyncSearch', () => {
  it('keeps results when the list reference changes but content is identical', () => {
    const initialList: Item[] = [{ name: 'apple' }, { name: 'banana' }, { name: 'cherry' }];

    const { result, rerender } = renderHook(({ list }) => useAsyncSearch(list, getItemStr), {
      initialProps: { list: initialList },
    });

    act(() => {
      result.current[1]('apple');
    });
    expect(result.current[0]?.items).toEqual([{ name: 'apple' }]);

    rerender({ list: [...initialList] });

    expect(result.current[0]?.query).toBe('apple');
    expect(result.current[0]?.items).toEqual([{ name: 'apple' }]);
  });

  it('keeps results when an item is added to the list', () => {
    const initialList: Item[] = [{ name: 'apple' }, { name: 'banana' }];

    const { result, rerender } = renderHook(({ list }) => useAsyncSearch(list, getItemStr), {
      initialProps: { list: initialList },
    });

    act(() => {
      result.current[1]('apple');
    });
    expect(result.current[0]?.items).toEqual([{ name: 'apple' }]);

    rerender({ list: [...initialList, { name: 'date' }] });

    expect(result.current[0]?.query).toBe('apple');
    expect(result.current[0]?.items).toEqual([{ name: 'apple' }]);
  });

  it('clears results when resetSearch is called', () => {
    const list: Item[] = [{ name: 'apple' }, { name: 'banana' }];

    const { result } = renderHook(() => useAsyncSearch(list, getItemStr));

    act(() => {
      result.current[1]('apple');
    });
    expect(result.current[0]).toBeDefined();

    act(() => {
      result.current[2]();
    });
    expect(result.current[0]).toBeUndefined();
  });

  it('updates results when a new query is searched', () => {
    const list: Item[] = [{ name: 'apple' }, { name: 'banana' }, { name: 'apricot' }];

    const { result } = renderHook(() => useAsyncSearch(list, getItemStr));

    act(() => {
      result.current[1]('apple');
    });
    expect(result.current[0]?.query).toBe('apple');
    expect(result.current[0]?.items).toEqual([{ name: 'apple' }]);

    act(() => {
      result.current[1]('ban');
    });
    expect(result.current[0]?.query).toBe('ban');
    expect(result.current[0]?.items).toEqual([{ name: 'banana' }]);
  });
});
