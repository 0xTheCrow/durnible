import type { IClientWellKnown } from 'matrix-js-sdk';
import type { LivekitTransportConfig } from 'matrix-js-sdk/lib/matrixrtc';
import { isLivekitTransportConfig } from 'matrix-js-sdk/lib/matrixrtc';
import { RTC_FOCI_WELL_KNOWN_KEY } from './sfu';

export const getLivekitFoci = (clientWellKnown: IClientWellKnown): LivekitTransportConfig[] => {
  const foci: unknown = clientWellKnown[RTC_FOCI_WELL_KNOWN_KEY];
  if (!Array.isArray(foci)) return [];
  return foci.filter(isLivekitTransportConfig);
};
