import type { IClientWellKnown, MatrixClient } from 'matrix-js-sdk';
import { AutoDiscovery } from 'matrix-js-sdk';
import type { LivekitTransportConfig } from 'matrix-js-sdk/lib/matrixrtc';
import { isLivekitTransportConfig } from 'matrix-js-sdk/lib/matrixrtc';
import { RTC_FOCI_WELL_KNOWN_KEY } from './sfu';

export const getLivekitFoci = (clientWellKnown: IClientWellKnown): LivekitTransportConfig[] => {
  const foci: unknown = clientWellKnown[RTC_FOCI_WELL_KNOWN_KEY];
  if (!Array.isArray(foci)) return [];
  return foci.filter(isLivekitTransportConfig);
};

export const resolveLivekitFoci = async (
  matrixClient: MatrixClient,
  cachedFoci: LivekitTransportConfig[]
): Promise<LivekitTransportConfig[]> => {
  if (cachedFoci.length > 0) return cachedFoci;
  const domain = matrixClient.getDomain();
  if (!domain) return [];
  return getLivekitFoci(await AutoDiscovery.getRawClientConfig(domain));
};
