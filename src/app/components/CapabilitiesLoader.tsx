import type { ReactNode } from 'react';
import { useCallback, useEffect } from 'react';
import type { Capabilities } from 'matrix-js-sdk';
import { AsyncStatus, useAsyncCallback } from '../hooks/useAsyncCallback';
import { useMatrixClient } from '../hooks/useMatrixClient';

type CapabilitiesLoaderProps = {
  children: (capabilities: Capabilities | undefined) => ReactNode;
};
export function CapabilitiesLoader({ children }: CapabilitiesLoaderProps) {
  const mx = useMatrixClient();

  const [state, load] = useAsyncCallback(useCallback(() => mx.getCapabilities(), [mx]));

  useEffect(() => {
    load();
  }, [load]);

  return children(state.status === AsyncStatus.Success ? state.data : undefined);
}
