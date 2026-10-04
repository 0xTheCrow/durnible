import type { ReactNode } from 'react';
import type { CryptoApi } from 'matrix-js-sdk/lib/crypto-api';
import type { VerificationStatus } from '../hooks/encryption/useDeviceVerificationStatus';
import { useDeviceVerificationStatus } from '../hooks/encryption/useDeviceVerificationStatus';

type DeviceVerificationStatusProps = {
  crypto?: CryptoApi;
  userId: string;
  deviceId: string;
  children: (verificationStatus: VerificationStatus) => ReactNode;
};

export function DeviceVerificationStatus({
  crypto,
  userId,
  deviceId,
  children,
}: DeviceVerificationStatusProps) {
  const status = useDeviceVerificationStatus(crypto, userId, deviceId);

  return children(status);
}
