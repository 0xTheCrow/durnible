import type { RectCords } from 'folds';
import {
  Box,
  Button,
  config,
  Dialog,
  Icon,
  IconButton,
  Icons,
  Menu,
  MenuItem,
  PopOut,
  Spinner,
  Text,
} from 'folds';
import type { HttpApiEventHandlerMap, MatrixClient } from 'matrix-js-sdk';
import { HttpApiEvent } from 'matrix-js-sdk';
import FocusTrap from 'focus-trap-react';
import type { MouseEventHandler, ReactNode } from 'react';
import React, { useCallback, useEffect, useState } from 'react';
import {
  clearCacheAndReload,
  clearLoginData,
  initClient,
  logoutClient,
  startClient,
} from '../../../client/initMatrix';
import { SplashScreen } from '../../components/splash-screen';
import { ServerConfigsLoader } from '../../components/ServerConfigsLoader';
import { CapabilitiesProvider } from '../../hooks/useCapabilities';
import { MediaConfigProvider } from '../../hooks/useMediaConfig';
import { MatrixClientProvider } from '../../hooks/useMatrixClient';
import { SpecVersions } from './SpecVersions';
import { AsyncStatus, useAsyncCallback } from '../../hooks/useAsyncCallback';
import { useSyncState } from '../../hooks/useSyncState';
import { stopPropagation } from '../../utils/keyboard';
import { AuthMetadataProvider } from '../../hooks/useAuthMetadata';
import { getFallbackSession } from '../../state/sessions';

function ClientRootLoading() {
  return (
    <SplashScreen>
      <Box direction="Column" grow="Yes" alignItems="Center" justifyContent="Center" gap="400">
        <Spinner variant="Secondary" size="600" />
        <Text>Heating up</Text>
      </Box>
    </SplashScreen>
  );
}

function ClientRootOptions({ mx }: { mx?: MatrixClient }) {
  const [menuAnchor, setMenuAnchor] = useState<RectCords>();

  const handleToggle: MouseEventHandler<HTMLButtonElement> = (evt) => {
    const cords = evt.currentTarget.getBoundingClientRect();
    setMenuAnchor((currentState) => {
      if (currentState) return undefined;
      return cords;
    });
  };

  return (
    <IconButton
      style={{
        position: 'absolute',
        top: config.space.S100,
        right: config.space.S100,
      }}
      variant="Background"
      fill="None"
      onClick={handleToggle}
    >
      <Icon size="200" src={Icons.VerticalDots} />
      <PopOut
        anchor={menuAnchor}
        position="Bottom"
        align="End"
        offset={6}
        content={
          <FocusTrap
            focusTrapOptions={{
              initialFocus: false,
              returnFocusOnDeactivate: false,
              onDeactivate: () => setMenuAnchor(undefined),
              clickOutsideDeactivates: true,
              isKeyForward: (evt: KeyboardEvent) => evt.key === 'ArrowDown',
              isKeyBackward: (evt: KeyboardEvent) => evt.key === 'ArrowUp',
              escapeDeactivates: stopPropagation,
            }}
          >
            <Menu>
              <Box direction="Column" gap="100" style={{ padding: config.space.S100 }}>
                {mx && (
                  <MenuItem onClick={() => clearCacheAndReload(mx)} size="300" radii="300">
                    <Text as="span" size="T300" truncate>
                      Clear Cache and Reload
                    </Text>
                  </MenuItem>
                )}
                <MenuItem
                  onClick={() => {
                    if (mx) {
                      logoutClient(mx);
                      return;
                    }
                    clearLoginData();
                  }}
                  size="300"
                  radii="300"
                  variant="Critical"
                  fill="None"
                >
                  <Text as="span" size="T300" truncate>
                    Logout
                  </Text>
                </MenuItem>
              </Box>
            </Menu>
          </FocusTrap>
        }
      />
    </IconButton>
  );
}

const useLogoutListener = (mx?: MatrixClient) => {
  useEffect(() => {
    const handleLogout: HttpApiEventHandlerMap[HttpApiEvent.SessionLoggedOut] = async () => {
      mx?.stopClient();
      await mx?.clearStores();
      window.localStorage.clear();
      window.location.reload();
    };

    mx?.on(HttpApiEvent.SessionLoggedOut, handleLogout);
    return () => {
      mx?.removeListener(HttpApiEvent.SessionLoggedOut, handleLogout);
    };
  }, [mx]);
};

type ClientRootProps = {
  children: ReactNode;
};
export const isChunkLoadError = (err: Error) =>
  err.message.includes('Failed to fetch dynamically imported module') ||
  err.message.includes('error loading dynamically imported module');

export function ClientRoot({ children }: ClientRootProps) {
  const [loading, setLoading] = useState(true);
  const { baseUrl } = getFallbackSession() ?? {};

  const [loadState, loadMatrix] = useAsyncCallback<MatrixClient, Error, []>(
    useCallback(() => {
      const session = getFallbackSession();
      if (!session) {
        throw new Error('No session Found!');
      }
      return initClient(session);
    }, [])
  );
  const mx = loadState.status === AsyncStatus.Success ? loadState.data : undefined;
  const [startState, startMatrix] = useAsyncCallback<void, Error, [MatrixClient]>(
    useCallback((m) => startClient(m), [])
  );

  useLogoutListener(mx);

  useEffect(() => {
    if (loadState.status === AsyncStatus.Idle) {
      loadMatrix().catch((err) => console.error('ClientRoot: failed to load matrix client', err));
    }
  }, [loadState, loadMatrix]);

  useEffect(() => {
    if (mx && !mx.clientRunning) {
      startMatrix(mx);
    }
  }, [mx, startMatrix]);

  useSyncState(
    mx,
    useCallback((state) => {
      if (state === 'PREPARED') {
        setLoading(false);
      }
    }, [])
  );

  if (!baseUrl) return null;

  return (
    <SpecVersions baseUrl={baseUrl}>
      {loading && <ClientRootOptions mx={mx} />}
      {(loadState.status === AsyncStatus.Error || startState.status === AsyncStatus.Error) && (
        <SplashScreen>
          <Box direction="Column" grow="Yes" alignItems="Center" justifyContent="Center" gap="400">
            <Dialog>
              <Box direction="Column" gap="400" style={{ padding: config.space.S400 }}>
                {loadState.status === AsyncStatus.Error &&
                  (isChunkLoadError(loadState.error) ? (
                    <Text>Failed to load. The app was updated — please reload.</Text>
                  ) : (
                    <Text>{`Failed to load. ${loadState.error.message}`}</Text>
                  ))}
                {startState.status === AsyncStatus.Error && (
                  <Text>{`Failed to start. ${startState.error.message}`}</Text>
                )}
                <Button
                  variant="Critical"
                  onClick={
                    loadState.status === AsyncStatus.Error || !mx
                      ? () => window.location.reload()
                      : () =>
                          startMatrix(mx).catch((err) =>
                            console.error('ClientRoot: failed to start matrix client', err)
                          )
                  }
                >
                  <Text as="span" size="B400">
                    {loadState.status === AsyncStatus.Error ? 'Reload' : 'Retry'}
                  </Text>
                </Button>
              </Box>
            </Dialog>
          </Box>
        </SplashScreen>
      )}
      {loading || !mx ? (
        <ClientRootLoading />
      ) : (
        <MatrixClientProvider value={mx}>
          <ServerConfigsLoader>
            {(serverConfigs) => (
              <CapabilitiesProvider value={serverConfigs.capabilities ?? {}}>
                <MediaConfigProvider value={serverConfigs.mediaConfig ?? {}}>
                  <AuthMetadataProvider value={serverConfigs.authMetadata}>
                    {children}
                  </AuthMetadataProvider>
                </MediaConfigProvider>
              </CapabilitiesProvider>
            )}
          </ServerConfigsLoader>
        </MatrixClientProvider>
      )}
    </SpecVersions>
  );
}
