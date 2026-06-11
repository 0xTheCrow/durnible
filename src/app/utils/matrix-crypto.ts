import type { CryptoApi } from 'matrix-js-sdk/lib/crypto-api';

export const verifiedDevice = async (
  api: CryptoApi,
  userId: string,
  deviceId: string
): Promise<boolean | null> => {
  const status = await api.getDeviceVerificationStatus(userId, deviceId);

  if (!status) return null;

  const verified = status.crossSigningVerified;
  return verified;
};

export const isUserFullyCrossSigned = async (api: CryptoApi, userId: string): Promise<boolean> => {
  const hasCrossSigning = await api.userHasCrossSigningKeys(userId, true);
  if (!hasCrossSigning) return false;

  const deviceMap = await api.getUserDeviceInfo([userId], true);
  const devices = deviceMap.get(userId);
  if (!devices || devices.size === 0) return true;

  const statuses = await Promise.all(
    Array.from(devices.keys()).map((deviceId) => api.getDeviceVerificationStatus(userId, deviceId))
  );
  return statuses.every((status) => status?.signedByOwner ?? false);
};
