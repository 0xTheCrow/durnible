import { useCallback, useEffect } from 'react';
import { useAtom, useAtomValue } from 'jotai';
import type { CallParticipantEntry } from './useCallParticipantEntries';
import { checkIsEntryStreamingVideo } from './useCallParticipantEntries';
import {
  callFocusedParticipantAtom,
  callStateAtom,
  getCallFocusedParticipantKey,
} from '../../state/call';

export type CallFocus = {
  focusedEntry?: CallParticipantEntry;
  stripEntries: CallParticipantEntry[];
  focusEntry: (key: string) => void;
  stopWatchingFocusedEntry: () => void;
};

export const useCallFocusedEntry = (entries: CallParticipantEntry[]): CallFocus => {
  const callState = useAtomValue(callStateAtom);
  const connection =
    callState.status === 'connected' || callState.status === 'reconnecting'
      ? callState.connection
      : undefined;
  const [focusedParticipant, setFocusedParticipant] = useAtom(callFocusedParticipantAtom);
  const pickedFocusKey = getCallFocusedParticipantKey(focusedParticipant, connection);

  const focusedEntry = entries.find(
    (entry) => entry.key === pickedFocusKey && checkIsEntryStreamingVideo(entry)
  );
  const isPickedEntryStreaming = focusedEntry !== undefined;

  useEffect(() => {
    if (pickedFocusKey !== undefined && !isPickedEntryStreaming) {
      setFocusedParticipant(undefined);
    }
  }, [pickedFocusKey, isPickedEntryStreaming, setFocusedParticipant]);

  const focusEntry = useCallback(
    (key: string) => {
      if (!connection) return;
      setFocusedParticipant((current) =>
        getCallFocusedParticipantKey(current, connection) === key
          ? undefined
          : { connection, participantKey: key }
      );
    },
    [connection, setFocusedParticipant]
  );

  const stripEntries =
    focusedEntry && !focusedEntry.isScreensharing
      ? entries.filter((entry) => entry.key !== focusedEntry.key)
      : entries;

  const stopWatchingFocusedEntry = () => setFocusedParticipant(undefined);

  return { focusedEntry, stripEntries, focusEntry, stopWatchingFocusedEntry };
};
