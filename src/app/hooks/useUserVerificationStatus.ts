import { useCallback, useEffect, useState } from 'react';
import type { CryptoApi, CryptoEventHandlerMap } from 'matrix-js-sdk/lib/crypto-api';
import { CryptoEvent } from 'matrix-js-sdk/lib/crypto-api';
import { verifiedUser } from '../utils/matrix-crypto';
import { useAlive } from './useAlive';
import { useMatrixClient } from './useMatrixClient';
import { VerificationStatus } from './useDeviceVerificationStatus';

export const useUserTrustChange = (
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

export const useUserVerificationStatus = (
  crypto: CryptoApi | undefined,
  userId: string
): VerificationStatus => {
  const [verificationStatus, setVerificationStatus] = useState(VerificationStatus.Unknown);
  const alive = useAlive();

  const updateStatus = useCallback(async () => {
    if (!crypto) {
      setVerificationStatus(VerificationStatus.Unknown);
      return;
    }
    const verified = await verifiedUser(crypto, userId);
    if (alive()) {
      setVerificationStatus(verified ? VerificationStatus.Verified : VerificationStatus.Unverified);
    }
  }, [crypto, userId, alive]);

  useEffect(() => {
    updateStatus();
  }, [updateStatus]);

  useUserTrustChange(
    useCallback(
      (changedUserId) => {
        if (changedUserId === userId) {
          updateStatus();
        }
      },
      [userId, updateStatus]
    )
  );

  return verificationStatus;
};
