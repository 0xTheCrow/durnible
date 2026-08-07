import { atom } from 'jotai';
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
