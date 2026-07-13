import type { IClientWellKnown } from 'matrix-js-sdk';
import type { LivekitTransportConfig } from 'matrix-js-sdk/lib/matrixrtc';
import { isLivekitTransportConfig } from 'matrix-js-sdk/lib/matrixrtc';

export const RTC_FOCI_WELL_KNOWN_KEY = 'org.matrix.msc4143.rtc_foci';

export const getLivekitFoci = (clientWellKnown: IClientWellKnown): LivekitTransportConfig[] => {
  const foci: unknown = clientWellKnown[RTC_FOCI_WELL_KNOWN_KEY];
  if (!Array.isArray(foci)) return [];
  return foci.filter(isLivekitTransportConfig);
};
