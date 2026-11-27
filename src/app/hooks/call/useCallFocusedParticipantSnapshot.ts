import { useCallback, useEffect } from 'react';
import { useAtom, useAtomValue, useSetAtom } from 'jotai';
import { Track } from 'livekit-client';
import type { CallParticipantSnapshot } from './useCallParticipantSnapshots';
import { checkIsParticipantSnapshotStreamingVideo } from './useCallParticipantSnapshots';
import {
  callFocusedParticipantAtom,
  callPopOutAtom,
  callStateAtom,
  getCallFocusedParticipantKey,
} from '../../state/call';

export type CallFocus = {
  focusedParticipantSnapshot?: CallParticipantSnapshot;
  stripParticipantSnapshots: CallParticipantSnapshot[];
  focusParticipant: (key: string) => void;
  stopWatchingFocusedParticipantSnapshot: () => void;
};

export const useCallFocusedParticipantSnapshot = (
  participantSnapshots: CallParticipantSnapshot[]
): CallFocus => {
  const callState = useAtomValue(callStateAtom);
  const connection =
    callState.status === 'connected' || callState.status === 'reconnecting'
      ? callState.connection
      : undefined;
  const [focusedParticipant, setFocusedParticipant] = useAtom(callFocusedParticipantAtom);
  const setCallPopOut = useSetAtom(callPopOutAtom);
  const pickedFocusKey = getCallFocusedParticipantKey(focusedParticipant, connection);

  const focusedParticipantSnapshot = participantSnapshots.find(
    (participantSnapshot) =>
      participantSnapshot.key === pickedFocusKey &&
      checkIsParticipantSnapshotStreamingVideo(participantSnapshot)
  );
  const isPickedParticipantSnapshotStreaming = focusedParticipantSnapshot !== undefined;

  useEffect(() => {
    if (pickedFocusKey !== undefined && !isPickedParticipantSnapshotStreaming) {
      setFocusedParticipant(undefined);
    }
  }, [pickedFocusKey, isPickedParticipantSnapshotStreaming, setFocusedParticipant]);

  const focusParticipant = useCallback(
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

  const stripParticipantSnapshots =
    focusedParticipantSnapshot && !focusedParticipantSnapshot.isScreensharing
      ? participantSnapshots.filter(
          (participantSnapshot) => participantSnapshot.key !== focusedParticipantSnapshot.key
        )
      : participantSnapshots;

  const stopWatchingFocusedParticipantSnapshot = () => {
    setFocusedParticipant(undefined);
    if (!focusedParticipantSnapshot) return;
    const focusedSource = focusedParticipantSnapshot.isScreensharing
      ? Track.Source.ScreenShare
      : Track.Source.Camera;
    setCallPopOut((currentPopOut) =>
      currentPopOut?.participant === focusedParticipantSnapshot.participant &&
      currentPopOut.source === focusedSource
        ? undefined
        : currentPopOut
    );
  };

  return {
    focusedParticipantSnapshot,
    stripParticipantSnapshots,
    focusParticipant,
    stopWatchingFocusedParticipantSnapshot,
  };
};
