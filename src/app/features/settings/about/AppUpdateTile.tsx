import React from 'react';
import { Button, Text } from 'folds';
import { SettingTile } from '../../../components/setting-tile';
import type { DesktopAppUpdateStatus } from '../../../platform/desktop';
import { checkForDesktopAppUpdate, installDesktopAppUpdate } from '../../../platform/desktop';
import { useDesktopAppUpdateStatus } from '../../../platform/desktop/useDesktopAppUpdateStatus';

type UpdateAction = {
  label: string;
  onAction: () => void;
};

const getStatusDescription = (status: DesktopAppUpdateStatus): string => {
  switch (status.availability) {
    case 'unknown':
      return 'Updates are checked automatically in the background.';
    case 'checking':
      return 'Checking for updates…';
    case 'up-to-date':
      return 'Durnible is up to date.';
    case 'available':
      return `${status.version} is available to install.`;
    case 'downloading':
      return `Downloading ${status.version}… ${Math.round(status.percent)}%`;
    case 'installing':
      return `Installing ${status.version}…`;
    case 'install-failed':
      return `${status.version} did not install: ${status.message}`;
    case 'manual-download':
      return status.message
        ? `${status.version} is available. Updating in place failed: ${status.message}`
        : `${status.version} is available to download.`;
    case 'check-failed':
      return `Could not check for updates: ${status.message}`;
    default:
      return '';
  }
};

const getUpdateAction = (status: DesktopAppUpdateStatus): UpdateAction | undefined => {
  switch (status.availability) {
    case 'unknown':
    case 'up-to-date':
      return { label: 'Check Now', onAction: checkForDesktopAppUpdate };
    case 'available':
      return { label: 'Install', onAction: installDesktopAppUpdate };
    case 'check-failed':
      return { label: 'Try Again', onAction: checkForDesktopAppUpdate };
    case 'install-failed':
      return { label: 'Try Again', onAction: installDesktopAppUpdate };
    case 'manual-download':
      return { label: 'Download', onAction: () => window.open(status.releaseUrl) };
    default:
      return undefined;
  }
};

export function AppUpdateTile() {
  const status = useDesktopAppUpdateStatus();

  if (status.availability === 'unsupported') return null;

  const action = getUpdateAction(status);

  return (
    <SettingTile
      title="Updates"
      description={getStatusDescription(status)}
      after={
        action && (
          <Button
            onClick={action.onAction}
            variant="Secondary"
            fill="Soft"
            size="300"
            radii="300"
            outlined
          >
            <Text size="B300">{action.label}</Text>
          </Button>
        )
      }
    />
  );
}
