import { atom } from 'jotai';
import type { CallConnection } from '../plugins/call/CallConnection';

export const activeCallConnectionAtom = atom<CallConnection | undefined>(undefined);
