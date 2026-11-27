import React from 'react';
import type { ReactNode } from 'react';
import { act, renderHook } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { Provider, createStore } from 'jotai';
import type { Participant } from 'livekit-client';
import type { CallConnection } from '../../plugins/call/CallConnection';
import { callStateAtom } from '../../state/call';
import type { CallParticipantSnapshot } from './useCallParticipantSnapshots';
import { useCallFocusedParticipantSnapshot } from './useCallFocusedParticipantSnapshot';

const makeParticipantSnapshot = (
  key: string,
  { isScreensharing = false, isScreenshareAudioEnabled = false, isCameraEnabled = false } = {}
): CallParticipantSnapshot => ({
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

const renderFocus = (initialParticipantSnapshots: CallParticipantSnapshot[]) => {
  const store = createStore();
  connectToNewCall(store);
  let participantSnapshots = initialParticipantSnapshots;
  const wrapper = ({ children }: { children: ReactNode }) => (
    <Provider store={store}>{children}</Provider>
  );
  const rendered = renderHook(() => useCallFocusedParticipantSnapshot(participantSnapshots), {
    wrapper,
  });
  return {
    ...rendered,
    store,
    setParticipantSnapshots: (nextParticipantSnapshots: CallParticipantSnapshot[]) => {
      participantSnapshots = nextParticipantSnapshots;
      rendered.rerender();
    },
  };
};

describe('useCallFocusedParticipantSnapshot', () => {
  it('focuses nobody and keeps every participant in the strip when no one streams', () => {
    const participantSnapshots = [
      makeParticipantSnapshot('alice'),
      makeParticipantSnapshot('bob', { isCameraEnabled: true }),
    ];
    const { result } = renderFocus(participantSnapshots);

    expect(result.current.focusedParticipantSnapshot).toBeUndefined();
    expect(result.current.stripParticipantSnapshots).toEqual(participantSnapshots);
  });

  it('does not focus a participant who starts screensharing', () => {
    const { result, setParticipantSnapshots } = renderFocus([
      makeParticipantSnapshot('alice'),
      makeParticipantSnapshot('bob'),
    ]);

    setParticipantSnapshots([
      makeParticipantSnapshot('alice'),
      makeParticipantSnapshot('bob', { isScreensharing: true }),
    ]);

    expect(result.current.focusedParticipantSnapshot).toBeUndefined();
  });

  it('focuses a screensharer once picked', () => {
    const { result } = renderFocus([
      makeParticipantSnapshot('alice'),
      makeParticipantSnapshot('bob', { isScreensharing: true }),
    ]);

    act(() => result.current.focusParticipant('bob'));

    expect(result.current.focusedParticipantSnapshot?.key).toBe('bob');
  });

  it('clears the pick when the picked participant is picked again', () => {
    const { result } = renderFocus([makeParticipantSnapshot('alice', { isCameraEnabled: true })]);

    act(() => result.current.focusParticipant('alice'));
    act(() => result.current.focusParticipant('alice'));

    expect(result.current.focusedParticipantSnapshot).toBeUndefined();
  });

  it('ignores a pick for a participant streaming no video', () => {
    const { result } = renderFocus([makeParticipantSnapshot('alice')]);

    act(() => result.current.focusParticipant('alice'));

    expect(result.current.focusedParticipantSnapshot).toBeUndefined();
  });

  it('clears focus when the viewer stops watching', () => {
    const { result } = renderFocus([makeParticipantSnapshot('bob', { isScreensharing: true })]);
    act(() => result.current.focusParticipant('bob'));

    act(() => result.current.stopWatchingFocusedParticipantSnapshot());

    expect(result.current.focusedParticipantSnapshot).toBeUndefined();
  });

  it('does not refocus a screensharer who stops and starts again', () => {
    const { result, setParticipantSnapshots } = renderFocus([
      makeParticipantSnapshot('bob', { isScreensharing: true }),
    ]);
    act(() => result.current.focusParticipant('bob'));

    setParticipantSnapshots([makeParticipantSnapshot('bob')]);
    setParticipantSnapshots([makeParticipantSnapshot('bob', { isScreensharing: true })]);

    expect(result.current.focusedParticipantSnapshot).toBeUndefined();
  });

  it('ignores a pick made during a previous call', () => {
    const { result, store, rerender } = renderFocus([
      makeParticipantSnapshot('bob', { isScreensharing: true }),
    ]);
    act(() => result.current.focusParticipant('bob'));

    act(() => connectToNewCall(store));
    rerender();

    expect(result.current.focusedParticipantSnapshot).toBeUndefined();
  });

  it('keeps a screensharer in the strip but drops a focused camera from it', () => {
    const { result } = renderFocus([
      makeParticipantSnapshot('alice', { isCameraEnabled: true }),
      makeParticipantSnapshot('bob', { isScreensharing: true }),
    ]);

    expect(
      result.current.stripParticipantSnapshots.map((participantSnapshot) => participantSnapshot.key)
    ).toEqual(['alice', 'bob']);

    act(() => result.current.focusParticipant('alice'));

    expect(
      result.current.stripParticipantSnapshots.map((participantSnapshot) => participantSnapshot.key)
    ).toEqual(['bob']);
  });
});
