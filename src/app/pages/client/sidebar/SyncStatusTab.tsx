import React, { useCallback, useState } from 'react';
import { Icon, IconSrc, Icons, color } from 'folds';
import { SyncState } from 'matrix-js-sdk';
import { SidebarItemTooltip } from '../../../components/sidebar';
import { useMatrixClient } from '../../../hooks/useMatrixClient';
import { useSyncState } from '../../../hooks/useSyncState';

const WifiIcon: IconSrc = () => (
  <path
    d="M1 9l2 2c4.97-4.97 13.03-4.97 18 0l2-2C16.93 2.93 7.08 2.93 1 9zm8 8l3 3 3-3c-1.65-1.66-4.34-1.66-6 0zm-4-4l2 2c2.76-2.76 7.24-2.76 10 0l2-2C15.14 9.14 8.87 9.14 5 13z"
    fill="currentColor"
  />
);

type StateData = {
  current: SyncState | null;
  previous: SyncState | null | undefined;
};

export function SyncStatusTab() {
  const mx = useMatrixClient();
  const [stateData, setStateData] = useState<StateData>({
    current: null,
    previous: undefined,
  });

  useSyncState(
    mx,
    useCallback((current, previous) => {
      setStateData((s) => {
        if (s.current === current && s.previous === previous) {
          return s;
        }
        return { current, previous };
      });
    }, [])
  );

  const connecting =
    (stateData.current === SyncState.Prepared ||
      stateData.current === SyncState.Syncing ||
      stateData.current === SyncState.Catchup) &&
    stateData.previous !== SyncState.Syncing;

  const reconnecting = stateData.current === SyncState.Reconnecting;
  const error = stateData.current === SyncState.Error;

  if (!connecting && !reconnecting && !error) return null;

  let tooltip: string;
  let iconSrc: IconSrc;
  let iconColor: string;
  if (error) {
    tooltip = 'Connection Lost!';
    iconSrc = Icons.Warning;
    iconColor = color.Critical.Main;
  } else if (reconnecting) {
    tooltip = 'Reconnecting...';
    iconSrc = Icons.Warning;
    iconColor = color.Warning.Main;
  } else {
    tooltip = 'Connecting...';
    iconSrc = WifiIcon;
    iconColor = color.Success.Main;
  }

  return (
    <SidebarItemTooltip tooltip={tooltip}>
      {(triggerRef) => (
        <span
          ref={triggerRef}
          style={{
            color: iconColor,
            lineHeight: 0,
            animation: connecting ? 'sync-pulse 1.5s ease-in-out infinite' : undefined,
          }}
        >
          <Icon size="200" src={iconSrc} filled />
        </span>
      )}
    </SidebarItemTooltip>
  );
}
