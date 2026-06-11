import { useCallback, useEffect, useState } from 'react';
import type { CryptoApi } from 'matrix-js-sdk/lib/crypto-api';
import { isUserFullyCrossSigned } from '../utils/matrix-crypto';
import { useAlive } from './useAlive';
import { useDeviceListChange } from './useDeviceList';

export enum CrossSigningStatus {
  Unknown,
  Incomplete,
  Complete,
}

export const useUserCrossSigningStatus = (
  crypto: CryptoApi | undefined,
  userId: string
): CrossSigningStatus => {
  const [crossSigningStatus, setCrossSigningStatus] = useState(CrossSigningStatus.Unknown);
  const alive = useAlive();

  const updateStatus = useCallback(async () => {
    if (!crypto) {
      setCrossSigningStatus(CrossSigningStatus.Unknown);
      return;
    }
    const fullyCrossSigned = await isUserFullyCrossSigned(crypto, userId);
    if (alive()) {
      setCrossSigningStatus(
        fullyCrossSigned ? CrossSigningStatus.Complete : CrossSigningStatus.Incomplete
      );
    }
  }, [crypto, userId, alive]);

  useEffect(() => {
    updateStatus();
  }, [updateStatus]);

  useDeviceListChange(
    useCallback(
      (userIds) => {
        if (userIds.includes(userId)) {
          updateStatus();
        }
      },
      [userId, updateStatus]
    )
  );

  return crossSigningStatus;
};
