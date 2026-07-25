import { useEffect, useState } from 'react';
import type { IClientWellKnown } from 'matrix-js-sdk';
import { ClientEvent } from 'matrix-js-sdk';
import type { LivekitTransportConfig } from 'matrix-js-sdk/lib/matrixrtc';
import { useMatrixClient } from './useMatrixClient';
import { getLivekitFoci } from '../plugins/call/foci';

export const useLivekitFoci = (): LivekitTransportConfig[] => {
  const mx = useMatrixClient();
  const [foci, setFoci] = useState<LivekitTransportConfig[]>(() => {
    const clientWellKnown = mx.getClientWellKnown();
    return clientWellKnown ? getLivekitFoci(clientWellKnown) : [];
  });

  useEffect(() => {
    const handleClientWellKnown = (clientWellKnown: IClientWellKnown) => {
      setFoci(getLivekitFoci(clientWellKnown));
    };
    mx.on(ClientEvent.ClientWellKnown, handleClientWellKnown);
    return () => {
      mx.off(ClientEvent.ClientWellKnown, handleClientWellKnown);
    };
  }, [mx]);

  return foci;
};
