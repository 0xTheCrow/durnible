import { useAtomValue } from 'jotai';
import { callStateAtom } from '../../state/call';
import { useMicrophoneInputFloor } from '../../hooks/call/useMicrophoneInputFloor';

export function CallMicrophoneGate(): null {
  const callState = useAtomValue(callStateAtom);
  const livekitRoom =
    callState.status === 'connected' || callState.status === 'reconnecting'
      ? callState.connection.livekitRoom
      : undefined;

  useMicrophoneInputFloor(livekitRoom);

  return null;
}
