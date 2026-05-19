import type { MatrixEvent, MatrixEventHandlerMap } from 'matrix-js-sdk';
import { MatrixEventEvent } from 'matrix-js-sdk';
import type { Dispatch, ReactNode, SetStateAction } from 'react';
import React, { useEffect, useState } from 'react';
import { MessageEvent } from '../../../../types/matrix/room';

type EncryptedContentProps = {
  mEvent: MatrixEvent;
  children: (retrying: boolean, setRetrying: Dispatch<SetStateAction<boolean>>) => ReactNode;
};

export function EncryptedContent({ mEvent, children }: EncryptedContentProps) {
  const [, setEncrypted] = useState(mEvent.getType() === MessageEvent.RoomMessageEncrypted);
  const [retrying, setRetrying] = useState(false);

  useEffect(() => {
    setEncrypted(mEvent.getType() === MessageEvent.RoomMessageEncrypted);
    const handleDecrypted: MatrixEventHandlerMap[MatrixEventEvent.Decrypted] = (event) => {
      setEncrypted(event.getType() === MessageEvent.RoomMessageEncrypted);
    };
    mEvent.on(MatrixEventEvent.Decrypted, handleDecrypted);
    return () => {
      mEvent.removeListener(MatrixEventEvent.Decrypted, handleDecrypted);
    };
  }, [mEvent]);

  return <>{children(retrying, setRetrying)}</>;
}
