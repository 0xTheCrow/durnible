import React, { useCallback, useState } from 'react';
import { Icon, IconSrc, Icons } from 'folds';
import { SyncState } from 'matrix-js-sdk';
import { SidebarAvatar, SidebarItem, SidebarItemTooltip } from '../../../components/sidebar';
import { useMatrixClient } from '../../../hooks/useMatrixClient';
import { useSyncState } from '../../../hooks/useSyncState';

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
  if (error) {
    tooltip = 'Connection Lost!';
    iconSrc = Icons.Warning;
  } else if (reconnecting) {
    tooltip = 'Reconnecting...';
    iconSrc = Icons.Warning;
  } else {
    tooltip = 'Connecting...';
    iconSrc = Icons.Reload;
  }

  return (
    <SidebarItem>
      <SidebarItemTooltip tooltip={tooltip}>
        {(triggerRef) => (
          <SidebarAvatar ref={triggerRef} outlined>
            <Icon src={iconSrc} />
          </SidebarAvatar>
        )}
      </SidebarItemTooltip>
    </SidebarItem>
  );
}
