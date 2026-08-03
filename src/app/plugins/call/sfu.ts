import type { MatrixClient } from 'matrix-js-sdk';
import { trimTrailingSlash } from '../../utils/common';

export class SfuAuthError extends Error {}

export type SfuConnectionDetails = {
  url: string;
  jwt: string;
};

export const getSfuConnectionDetails = async (
  mx: MatrixClient,
  livekitServiceUrl: string,
  roomId: string
): Promise<SfuConnectionDetails> => {
  const deviceId = mx.getDeviceId();
  if (!deviceId) throw new SfuAuthError('Matrix device id unavailable');

  let openIdToken;
  try {
    openIdToken = await mx.getOpenIdToken();
  } catch (error) {
    throw new SfuAuthError(`Failed to obtain Matrix OpenID token: ${error}`);
  }

  const response = await fetch(`${trimTrailingSlash(livekitServiceUrl)}/sfu/get`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      room: roomId,
      openid_token: openIdToken,
      device_id: deviceId,
    }),
  });
  if (!response.ok) {
    throw new SfuAuthError(`SFU credential request failed: ${response.status}`);
  }

  const details = (await response.json()) as SfuConnectionDetails;
  if (typeof details.url !== 'string' || typeof details.jwt !== 'string') {
    throw new SfuAuthError('SFU credential response is malformed');
  }
  return details;
};
