import { MatrixEvent, MatrixEventEvent, MatrixEventHandlerMap } from 'matrix-js-sdk';
import React, { Dispatch, ReactNode, SetStateAction, useEffect, useReducer, useState } from 'react';
import { MessageEvent } from '../../../../types/matrix/room';

// How long to wait before showing the "not decrypted" fallback on initial render.
// Fast decryptions complete before this fires and never flash the error state.
const DECRYPT_SETTLE_MS = 500;

type EncryptedContentProps = {
  mEvent: MatrixEvent;
  children: (retrying: boolean, setRetrying: Dispatch<SetStateAction<boolean>>) => ReactNode;
};

export function EncryptedContent({ mEvent, children }: EncryptedContentProps) {
  const [settling, setSettling] = useState(
    mEvent.getType() === MessageEvent.RoomMessageEncrypted
  );
  const [, forceUpdate] = useReducer((n: number) => n + 1, 0);
  const [retrying, setRetrying] = useState(false);

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;

    const handleDecrypted: MatrixEventHandlerMap[MatrixEventEvent.Decrypted] = () => {
      clearTimeout(timer);
      setSettling(false);
      forceUpdate();
    };

    mEvent.on(MatrixEventEvent.Decrypted, handleDecrypted);

    if (mEvent.getType() === MessageEvent.RoomMessageEncrypted) {
      setSettling(true);
      timer = setTimeout(() => setSettling(false), DECRYPT_SETTLE_MS);
    } else {
      setSettling(false);
    }

    return () => {
      clearTimeout(timer);
      mEvent.removeListener(MatrixEventEvent.Decrypted, handleDecrypted);
    };
  }, [mEvent]);

  if (settling) return null;
  return <>{children(retrying, setRetrying)}</>;
}
