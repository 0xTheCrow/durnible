import React from 'react';
import type { ReactNode } from 'react';
import { act, renderHook } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { Provider, createStore } from 'jotai';
import type { Participant } from 'livekit-client';
import type { CallConnection } from '../../plugins/call/CallConnection';
import { callStateAtom } from '../../state/call';
import type { CallParticipantEntry } from './useCallParticipantEntries';
import { useCallFocusedEntry } from './useCallFocusedEntry';

const makeEntry = (
  key: string,
  { isScreensharing = false, isScreenshareAudioEnabled = false, isCameraEnabled = false } = {}
): CallParticipantEntry => ({
  key,
  participant: { identity: key } as unknown as Participant,
  isScreensharing,
  isScreenshareAudioEnabled,
  isCameraEnabled,
  isMicrophoneMuted: false,
});

const connectToNewCall = (store: ReturnType<typeof createStore>) =>
  store.set(callStateAtom, {
    status: 'connected',
    roomId: '!voice:example.org',
    connection: {} as unknown as CallConnection,
  });

const renderFocus = (initialEntries: CallParticipantEntry[]) => {
  const store = createStore();
  connectToNewCall(store);
  let entries = initialEntries;
  const wrapper = ({ children }: { children: ReactNode }) => (
    <Provider store={store}>{children}</Provider>
  );
  const rendered = renderHook(() => useCallFocusedEntry(entries), { wrapper });
  return {
    ...rendered,
    store,
    setEntries: (nextEntries: CallParticipantEntry[]) => {
      entries = nextEntries;
      rendered.rerender();
    },
  };
};

describe('useCallFocusedEntry', () => {
  it('focuses nobody and keeps every entry in the strip when no one streams', () => {
    const entries = [makeEntry('alice'), makeEntry('bob', { isCameraEnabled: true })];
    const { result } = renderFocus(entries);

    expect(result.current.focusedEntry).toBeUndefined();
    expect(result.current.stripEntries).toEqual(entries);
  });

  it('does not focus a participant who starts screensharing', () => {
    const { result, setEntries } = renderFocus([makeEntry('alice'), makeEntry('bob')]);

    setEntries([makeEntry('alice'), makeEntry('bob', { isScreensharing: true })]);

    expect(result.current.focusedEntry).toBeUndefined();
  });

  it('focuses a screensharer once picked', () => {
    const { result } = renderFocus([
      makeEntry('alice'),
      makeEntry('bob', { isScreensharing: true }),
    ]);

    act(() => result.current.focusEntry('bob'));

    expect(result.current.focusedEntry?.key).toBe('bob');
  });

  it('clears the pick when the picked entry is picked again', () => {
    const { result } = renderFocus([makeEntry('alice', { isCameraEnabled: true })]);

    act(() => result.current.focusEntry('alice'));
    act(() => result.current.focusEntry('alice'));

    expect(result.current.focusedEntry).toBeUndefined();
  });

  it('ignores a pick for a participant streaming no video', () => {
    const { result } = renderFocus([makeEntry('alice')]);

    act(() => result.current.focusEntry('alice'));

    expect(result.current.focusedEntry).toBeUndefined();
  });

  it('clears focus when the viewer stops watching', () => {
    const { result } = renderFocus([makeEntry('bob', { isScreensharing: true })]);
    act(() => result.current.focusEntry('bob'));

    act(() => result.current.stopWatchingFocusedEntry());

    expect(result.current.focusedEntry).toBeUndefined();
  });

  it('does not refocus a screensharer who stops and starts again', () => {
    const { result, setEntries } = renderFocus([makeEntry('bob', { isScreensharing: true })]);
    act(() => result.current.focusEntry('bob'));

    setEntries([makeEntry('bob')]);
    setEntries([makeEntry('bob', { isScreensharing: true })]);

    expect(result.current.focusedEntry).toBeUndefined();
  });

  it('ignores a pick made during a previous call', () => {
    const { result, store, rerender } = renderFocus([makeEntry('bob', { isScreensharing: true })]);
    act(() => result.current.focusEntry('bob'));

    act(() => connectToNewCall(store));
    rerender();

    expect(result.current.focusedEntry).toBeUndefined();
  });

  it('keeps a screensharer in the strip but drops a focused camera from it', () => {
    const { result } = renderFocus([
      makeEntry('alice', { isCameraEnabled: true }),
      makeEntry('bob', { isScreensharing: true }),
    ]);

    expect(result.current.stripEntries.map((entry) => entry.key)).toEqual(['alice', 'bob']);

    act(() => result.current.focusEntry('alice'));

    expect(result.current.stripEntries.map((entry) => entry.key)).toEqual(['bob']);
  });
});
