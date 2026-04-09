import React from 'react';
import { Icon, IconSrc, Icons, color } from 'folds';
import { SidebarItemTooltip } from '../../../components/sidebar';
import { ConnectionStatus, useConnectionStatus } from '../../../hooks/useConnectionStatus';

function WifiIcon() {
  return (
    <path
      d="M1 9l2 2c4.97-4.97 13.03-4.97 18 0l2-2C16.93 2.93 7.08 2.93 1 9zm8 8l3 3 3-3c-1.65-1.66-4.34-1.66-6 0zm-4-4l2 2c2.76-2.76 7.24-2.76 10 0l2-2C15.14 9.14 8.87 9.14 5 13z"
      fill="currentColor"
    />
  );
}

export const getConnectionStatusProps = (
  status: ConnectionStatus
): { tooltip: string; iconSrc: IconSrc; iconColor: string } | null => {
  if (!status) return null;
  if (status === 'error') {
    return { tooltip: 'Connection Lost!', iconSrc: Icons.Warning, iconColor: color.Critical.Main };
  }
  if (status === 'reconnecting') {
    return { tooltip: 'Reconnecting...', iconSrc: Icons.Warning, iconColor: color.Warning.Main };
  }
  return { tooltip: 'Connecting...', iconSrc: WifiIcon, iconColor: color.Success.Main };
};

export function SyncStatusTab() {
  const status = useConnectionStatus();
  const statusProps = getConnectionStatusProps(status);

  if (!statusProps) return null;

  return (
    <SidebarItemTooltip tooltip={statusProps.tooltip}>
      {(triggerRef) => (
        <span
          ref={triggerRef}
          style={{
            color: statusProps.iconColor,
            lineHeight: 0,
            animation: status === 'connecting' ? 'sync-pulse 2.5s ease-in-out infinite' : undefined,
          }}
        >
          <Icon size="200" src={statusProps.iconSrc} filled />
        </span>
      )}
    </SidebarItemTooltip>
  );
}
