import { atom } from 'jotai';
import type { Participant, Track } from 'livekit-client';
import type { CallConnection } from '../plugins/call/CallConnection';

export type CallState =
  | { status: 'idle' }
  | { status: 'connecting'; roomId: string }
  | { status: 'connected'; roomId: string; connection: CallConnection }
  | { status: 'reconnecting'; roomId: string; connection: CallConnection }
  | { status: 'failed'; roomId: string; error: Error };

export const callStateAtom = atom<CallState>({ status: 'idle' });

export const activeCallRoomIdAtom = atom<string | undefined>((get) => {
  const callState = get(callStateAtom);
  if (callState.status === 'idle' || callState.status === 'failed') return undefined;
  return callState.roomId;
});

export const isCallPaneCollapsedAtom = atom(false);

export type CallPopOut = {
  participant: Participant;
  source: Track.Source.Camera | Track.Source.ScreenShare;
  displayName: string;
  popOutWindow: Window;
};

export const callPopOutAtom = atom<CallPopOut | undefined>(undefined);

export const callPreJoinRoomIdAtom = atom<string | undefined>(undefined);

export const isCallDeafenedAtom = atom(false);

export type CallFocusedParticipant = {
  connection: CallConnection;
  participantKey: string;
};

export const callFocusedParticipantAtom = atom<CallFocusedParticipant | undefined>(undefined);

export const getCallFocusedParticipantKey = (
  focusedParticipant: CallFocusedParticipant | undefined,
  connection: CallConnection | undefined
): string | undefined =>
  connection && focusedParticipant?.connection === connection
    ? focusedParticipant.participantKey
    : undefined;

export type ActiveCallParticipantEntry = {
  identity: string;
  isLocal: boolean;
  isMicrophoneMuted: boolean;
  isScreenshareAudioEnabled: boolean;
};

export const activeCallParticipantEntriesAtom = atom<ActiveCallParticipantEntry[]>([]);
