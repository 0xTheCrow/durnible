import type { CryptoEventHandlerMap } from 'matrix-js-sdk/lib/crypto-api';
import { CryptoEvent } from 'matrix-js-sdk/lib/crypto-api';
import { useEffect } from 'react';
import { useMatrixClient } from './useMatrixClient';

export const useUserTrustStatusChange = (
  onChange: CryptoEventHandlerMap[CryptoEvent.UserTrustStatusChanged]
) => {
  const mx = useMatrixClient();

  useEffect(() => {
    mx.on(CryptoEvent.UserTrustStatusChanged, onChange);
    return () => {
      mx.removeListener(CryptoEvent.UserTrustStatusChanged, onChange);
    };
  }, [mx, onChange]);
};
