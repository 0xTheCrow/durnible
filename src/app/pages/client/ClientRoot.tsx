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
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useAtomValue } from 'jotai';
import {
  clearCacheAndReload,
  clearLocalSessionData,
  clearLoginData,
  initClient,
  logoutClient,
  startClient,
} from '../../../client/initMatrix';
import { SplashScreen } from '../../components/splash-screen';
import * as splashCss from '../../components/splash-screen/SplashScreen.css';
import { ServerConfigsLoader } from '../../components/ServerConfigsLoader';
import { CapabilitiesProvider } from '../../hooks/useCapabilities';
import { MediaConfigProvider } from '../../hooks/useMediaConfig';
import { MatrixClientProvider } from '../../hooks/useMatrixClient';
import { SpecVersions } from './SpecVersions';
import { AsyncStatus, useAsyncCallback } from '../../hooks/useAsyncCallback';
import { useSyncState } from '../../hooks/useSyncState';
import { stopPropagation } from '../../utils/keyboard';
import { setGifServerClient } from '../../utils/gifServer';
import { AuthMetadataProvider } from '../../hooks/useAuthMetadata';
import { getStoredSession } from '../../state/sessions';
import { overlayVisibleAtom, useReadinessGate } from '../../state/readiness';
import { logStartupSummary, startupMark } from '../../utils/startupPerf';
import { checkSessionLockFree, getSessionLock } from '../../utils/sessionLock';

class OtherTabActiveError extends Error {}

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
      await clearLocalSessionData(mx);
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
  const [needsTakeoverConfirm, setNeedsTakeoverConfirm] = useState(() => !checkSessionLockFree());
  const [sessionActiveInOtherTab, setSessionActiveInOtherTab] = useState(false);
  const startupLoggedRef = useRef(false);
  const mxRef = useRef<MatrixClient | undefined>(undefined);
  const { baseUrl } = getStoredSession() ?? {};

  const handleOtherTabTakeover = useCallback(async () => {
    setSessionActiveInOtherTab(true);
    mxRef.current?.stopClient();
  }, []);

  const handleTakeoverConfirm = useCallback(() => {
    setNeedsTakeoverConfirm(false);
  }, []);

  const [loadState, loadMatrix] = useAsyncCallback<MatrixClient, Error, []>(
    useCallback(async () => {
      const session = getStoredSession();
      if (!session) {
        throw new Error('No session Found!');
      }
      const acquired = await getSessionLock(handleOtherTabTakeover);
      if (!acquired) {
        throw new OtherTabActiveError();
      }
      const mx = await initClient(session);
      mxRef.current = mx;
      return mx;
    }, [handleOtherTabTakeover])
  );
  const mx = loadState.status === AsyncStatus.Success ? loadState.data : undefined;
  const [startState, startMatrix] = useAsyncCallback<void, Error, [MatrixClient]>(
    useCallback((m) => startClient(m), [])
  );

  useLogoutListener(mx);

  useEffect(() => {
    if (loadState.status === AsyncStatus.Idle && !needsTakeoverConfirm) {
      loadMatrix().catch((err) => {
        if (err instanceof OtherTabActiveError) return;
        console.error('ClientRoot: failed to load matrix client', err);
      });
    }
  }, [loadState, loadMatrix, needsTakeoverConfirm]);

  useEffect(() => {
    if (mx && !mx.clientRunning && !sessionActiveInOtherTab) {
      startMatrix(mx);
    }
  }, [mx, startMatrix, sessionActiveInOtherTab]);

  useEffect(() => {
    setGifServerClient(mx ?? null);
    return () => setGifServerClient(null);
  }, [mx]);

  useSyncState(
    mx,
    useCallback((state) => {
      if (state === 'PREPARED') {
        if (!startupLoggedRef.current) {
          startupLoggedRef.current = true;
          startupMark('sync-prepared');
          logStartupSummary();
        }
        setLoading(false);
      }
    }, [])
  );

  useReadinessGate('boot', !loading && !!mx);
  const overlayVisible = useAtomValue(overlayVisibleAtom);
  const [bootDone, setBootDone] = useState(false);
  useEffect(() => {
    if (!overlayVisible || bootDone) return undefined;
    return () => setBootDone(true);
  }, [overlayVisible, bootDone]);
  const showSplash = !bootDone;
  const hasError =
    loadState.status === AsyncStatus.Error || startState.status === AsyncStatus.Error;

  if (!baseUrl) return null;

  if (sessionActiveInOtherTab) {
    return (
      <SplashScreen>
        <Box
          direction="Column"
          grow="Yes"
          alignItems="Center"
          justifyContent="Center"
          gap="400"
          data-testid="client-root-other-tab-active"
        >
          <Text align="Center">Durnible is open in another tab.</Text>
          <Text align="Center">
            Switch to the other tab to use Durnible. This tab can now be closed.
          </Text>
        </Box>
      </SplashScreen>
    );
  }

  if (needsTakeoverConfirm) {
    return (
      <SplashScreen>
        <Box
          direction="Column"
          grow="Yes"
          alignItems="Center"
          justifyContent="Center"
          gap="400"
          data-testid="client-root-takeover-confirm"
        >
          <Text align="Center">
            Durnible is open in another tab. Continue to use Durnible here and disconnect the other
            tab.
          </Text>
          <Button
            data-testid="client-root-takeover-confirm-action"
            variant="Primary"
            onClick={handleTakeoverConfirm}
          >
            <Text as="span" size="B400">
              Continue
            </Text>
          </Button>
        </Box>
      </SplashScreen>
    );
  }

  return (
    <SpecVersions baseUrl={baseUrl}>
      {mx && !loading && (
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
      <div
        className={splashCss.SplashScreenOverlay}
        data-visible={showSplash || hasError}
        aria-hidden={!(showSplash || hasError)}
      >
        {loading && <ClientRootOptions mx={mx} />}
        <SplashScreen>
          <Box direction="Column" grow="Yes" alignItems="Center" justifyContent="Center" gap="400">
            {hasError ? (
              <Dialog data-testid="client-root-error-dialog">
                <Box direction="Column" gap="400" style={{ padding: config.space.S400 }}>
                  {loadState.status === AsyncStatus.Error &&
                    (isChunkLoadError(loadState.error) ? (
                      <Text data-testid="client-root-load-error-chunk">
                        Failed to load. The app was updated — please reload.
                      </Text>
                    ) : (
                      <Text data-testid="client-root-load-error-generic">
                        {`Failed to load. ${loadState.error.message}`}
                      </Text>
                    ))}
                  {startState.status === AsyncStatus.Error && (
                    <Text data-testid="client-root-start-error">
                      {`Failed to start. ${startState.error.message}`}
                    </Text>
                  )}
                  <Button
                    data-testid="client-root-error-action"
                    data-variant={loadState.status === AsyncStatus.Error ? 'reload' : 'retry'}
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
            ) : (
              <>
                <Spinner variant="Secondary" size="600" />
                <Text>Heating up</Text>
              </>
            )}
          </Box>
        </SplashScreen>
      </div>
    </SpecVersions>
  );
}
