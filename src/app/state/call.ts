import { atom } from 'jotai';
import type { CallConnection } from '../plugins/call/CallConnection';

export type CallState =
  | { status: 'idle' }
  | { status: 'connecting'; roomId: string }
  | { status: 'connected'; roomId: string; connection: CallConnection }
  | { status: 'reconnecting'; roomId: string; connection: CallConnection }
  | { status: 'failed'; roomId: string; error: Error };

export const callStateAtom = atom<CallState>({ status: 'idle' });
