import { useCallback, useEffect, useState } from 'react';
import type { CallParticipantEntry } from './useCallParticipantEntries';
import { checkIsEntryStreamingVideo } from './useCallParticipantEntries';

export type CallFocus = {
  focusedEntry?: CallParticipantEntry;
  stripEntries: CallParticipantEntry[];
  focusEntry: (key: string) => void;
  stopWatchingFocusedEntry: () => void;
};

export const useCallFocusedEntry = (entries: CallParticipantEntry[]): CallFocus => {
  const [pickedFocusKey, setPickedFocusKey] = useState<string>();
  const [autoFocusKey, setAutoFocusKey] = useState<string>();
  const [dismissedScreenshareKey, setDismissedScreenshareKey] = useState<string>();

  useEffect(() => {
    const checkIsStillScreensharing = (key: string | undefined) =>
      entries.some((entry) => entry.key === key && entry.isScreensharing);

    setAutoFocusKey((currentKey) => {
      if (checkIsStillScreensharing(currentKey)) return currentKey;
      return entries.find((entry) => entry.isScreensharing)?.key;
    });
    setDismissedScreenshareKey((currentKey) =>
      checkIsStillScreensharing(currentKey) ? currentKey : undefined
    );
  }, [entries]);

  const focusEntry = useCallback((key: string) => {
    setPickedFocusKey((currentKey) => (currentKey === key ? undefined : key));
  }, []);

  const autoFocusedEntry =
    autoFocusKey === dismissedScreenshareKey
      ? undefined
      : entries.find((entry) => entry.key === autoFocusKey);
  const pickedEntry = entries.find(
    (entry) => entry.key === pickedFocusKey && checkIsEntryStreamingVideo(entry)
  );
  const focusedEntry = pickedEntry ?? autoFocusedEntry;
  const stripEntries =
    focusedEntry && !focusedEntry.isScreensharing
      ? entries.filter((entry) => entry.key !== focusedEntry.key)
      : entries;

  const stopWatchingFocusedEntry = () => {
    setPickedFocusKey(undefined);
    if (focusedEntry?.isScreensharing) setDismissedScreenshareKey(focusedEntry.key);
  };

  return { focusedEntry, stripEntries, focusEntry, stopWatchingFocusedEntry };
};
