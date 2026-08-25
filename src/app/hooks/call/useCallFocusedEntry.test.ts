import { act, renderHook } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import type { Participant } from 'livekit-client';
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

const renderFocus = (initialEntries: CallParticipantEntry[]) => {
  let entries = initialEntries;
  const rendered = renderHook(() => useCallFocusedEntry(entries));
  return {
    ...rendered,
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

  it('auto focuses a participant who starts screensharing', () => {
    const { result, setEntries } = renderFocus([makeEntry('alice'), makeEntry('bob')]);

    setEntries([makeEntry('alice'), makeEntry('bob', { isScreensharing: true })]);

    expect(result.current.focusedEntry?.key).toBe('bob');
  });

  it('keeps the first screensharer focused when a second one starts', () => {
    const { result, setEntries } = renderFocus([
      makeEntry('alice'),
      makeEntry('bob', { isScreensharing: true }),
    ]);

    setEntries([
      makeEntry('alice', { isScreensharing: true }),
      makeEntry('bob', { isScreensharing: true }),
    ]);

    expect(result.current.focusedEntry?.key).toBe('bob');
  });

  it('moves to a remaining screensharer, then clears when the last one stops', () => {
    const { result, setEntries } = renderFocus([
      makeEntry('alice', { isScreensharing: true }),
      makeEntry('bob', { isScreensharing: true }),
    ]);
    expect(result.current.focusedEntry?.key).toBe('alice');

    setEntries([makeEntry('alice'), makeEntry('bob', { isScreensharing: true })]);
    expect(result.current.focusedEntry?.key).toBe('bob');

    setEntries([makeEntry('alice'), makeEntry('bob')]);
    expect(result.current.focusedEntry).toBeUndefined();
  });

  it('lets an explicit pick win over the auto focused screenshare', () => {
    const { result } = renderFocus([
      makeEntry('alice', { isCameraEnabled: true }),
      makeEntry('bob', { isScreensharing: true }),
    ]);
    expect(result.current.focusedEntry?.key).toBe('bob');

    act(() => result.current.focusEntry('alice'));

    expect(result.current.focusedEntry?.key).toBe('alice');
  });

  it('clears the pick when the picked entry is picked again', () => {
    const { result } = renderFocus([
      makeEntry('alice', { isCameraEnabled: true }),
      makeEntry('bob', { isScreensharing: true }),
    ]);

    act(() => result.current.focusEntry('alice'));
    act(() => result.current.focusEntry('alice'));

    expect(result.current.focusedEntry?.key).toBe('bob');
  });

  it('ignores a pick for a participant streaming no video', () => {
    const { result } = renderFocus([
      makeEntry('alice'),
      makeEntry('bob', { isScreensharing: true }),
    ]);

    act(() => result.current.focusEntry('alice'));

    expect(result.current.focusedEntry?.key).toBe('bob');
  });

  it('does not re-latch a dismissed screenshare until it stops and starts again', () => {
    const sharing = () => [makeEntry('alice'), makeEntry('bob', { isScreensharing: true })];
    const { result, setEntries } = renderFocus(sharing());
    expect(result.current.focusedEntry?.key).toBe('bob');

    act(() => result.current.stopWatchingFocusedEntry());
    expect(result.current.focusedEntry).toBeUndefined();

    setEntries(sharing());
    expect(result.current.focusedEntry).toBeUndefined();

    setEntries([makeEntry('alice'), makeEntry('bob')]);
    setEntries(sharing());
    expect(result.current.focusedEntry?.key).toBe('bob');
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

  it('clears focus when the picked participant leaves the call', () => {
    const { result, setEntries } = renderFocus([
      makeEntry('alice', { isCameraEnabled: true }),
      makeEntry('bob'),
    ]);

    act(() => result.current.focusEntry('alice'));
    expect(result.current.focusedEntry?.key).toBe('alice');

    setEntries([makeEntry('bob')]);

    expect(result.current.focusedEntry).toBeUndefined();
  });
});
