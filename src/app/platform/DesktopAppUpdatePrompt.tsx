import React, { useState } from 'react';
import {
  Box,
  Button,
  Icon,
  IconButton,
  Icons,
  Overlay,
  OverlayBackdrop,
  OverlayCenter,
  ProgressBar,
  Spinner,
  Text,
} from 'folds';
import type { DesktopAppUpdateStatus } from './desktop';
import {
  cancelDesktopAppUpdateDownload,
  checkForDesktopAppUpdate,
  installDesktopAppUpdate,
} from './desktop';
import { useDesktopAppUpdateStatus } from './useDesktopAppUpdateStatus';
import { useAppUpdateSnooze } from './appUpdateSnooze';
import * as css from './DesktopAppUpdatePrompt.css';

const CHECK_FAILED_PROMPT_KEY = 'check-failed';

const getPromptKey = (status: DesktopAppUpdateStatus): string | undefined => {
  switch (status.availability) {
    case 'available':
    case 'install-failed':
    case 'manual-download':
      return status.version;
    case 'check-failed':
      return CHECK_FAILED_PROMPT_KEY;
    default:
      return undefined;
  }
};

type PromptAction = {
  label: string;
  onAction: () => void;
};

type PromptContent = {
  title: string;
  description?: string;
  action?: PromptAction;
};

const getPromptContent = (status: DesktopAppUpdateStatus): PromptContent | undefined => {
  switch (status.availability) {
    case 'available':
      return {
        title: `Durnible ${status.version} is available`,
        action: { label: 'Install', onAction: installDesktopAppUpdate },
      };
    case 'install-failed':
      return {
        title: `Durnible ${status.version} did not install`,
        description: status.message,
        action: { label: 'Try again', onAction: installDesktopAppUpdate },
      };
    case 'manual-download':
      return {
        title: `Durnible ${status.version} is available`,
        description: status.message
          ? `Updating in place failed: ${status.message}`
          : 'Download it from the release page.',
        action: { label: 'Download', onAction: () => window.open(status.releaseUrl) },
      };
    case 'check-failed':
      return {
        title: 'Could not check for updates',
        description: status.message,
        action: { label: 'Try again', onAction: checkForDesktopAppUpdate },
      };
    default:
      return undefined;
  }
};

type AppUpdateInstallOverlayProps = {
  version: string;
  downloadedPercent?: number;
};

function AppUpdateInstallOverlay({ version, downloadedPercent }: AppUpdateInstallOverlayProps) {
  const isDownloading = downloadedPercent !== undefined;

  return (
    <Overlay open backdrop={<OverlayBackdrop />}>
      <OverlayCenter>
        <Box className={css.AppUpdateOverlayCard} direction="Column" gap="400" alignItems="Center">
          <Spinner size="600" variant="Secondary" />
          <Box direction="Column" gap="200" alignItems="Center" style={{ width: '100%' }}>
            <Text size="H5" align="Center">
              {isDownloading ? `Downloading Durnible ${version}` : `Installing Durnible ${version}`}
            </Text>
            {isDownloading ? (
              <>
                <ProgressBar
                  style={{ width: '100%' }}
                  variant="Primary"
                  size="300"
                  min={0}
                  max={100}
                  value={downloadedPercent}
                />
                <Text size="T200" align="Center" priority="300">
                  {`${Math.round(downloadedPercent)}%`}
                </Text>
                <Button
                  size="300"
                  variant="Secondary"
                  fill="None"
                  radii="300"
                  onClick={cancelDesktopAppUpdateDownload}
                >
                  <Text size="B300">Cancel</Text>
                </Button>
              </>
            ) : (
              <Text size="T200" align="Center" priority="300">
                The window may be unresponsive until the update is finished. Durnible will restart
                itself after installation.
              </Text>
            )}
          </Box>
        </Box>
      </OverlayCenter>
    </Overlay>
  );
}

export function DesktopAppUpdatePrompt() {
  const status = useDesktopAppUpdateStatus();
  const promptKey = getPromptKey(status);
  const { isSnoozed, snoozePrompt } = useAppUpdateSnooze(promptKey);
  const [dismissedPromptKey, setDismissedPromptKey] = useState<string>();

  if (status.availability === 'downloading') {
    return <AppUpdateInstallOverlay version={status.version} downloadedPercent={status.percent} />;
  }

  if (status.availability === 'installing') {
    return <AppUpdateInstallOverlay version={status.version} />;
  }

  const content = getPromptContent(status);
  if (!content || isSnoozed || (promptKey && promptKey === dismissedPromptKey)) return null;

  const dismissPrompt = () => setDismissedPromptKey(promptKey);

  return (
    <Box className={css.AppUpdatePrompt} direction="Column" gap="400">
      <Box direction="Column" gap="100">
        <Box gap="200" alignItems="Start">
          <Box grow="Yes">
            <Text size="H6">{content.title}</Text>
          </Box>
          <Box shrink="No">
            <IconButton
              size="300"
              variant="Surface"
              fill="None"
              radii="300"
              onClick={dismissPrompt}
              aria-label="Dismiss update message"
            >
              <Icon size="100" src={Icons.Cross} />
            </IconButton>
          </Box>
        </Box>
        {content.description && (
          <Text size="T200" priority="300">
            {content.description}
          </Text>
        )}
      </Box>
      <Box gap="200" justifyContent="End">
        <Button size="300" variant="Secondary" fill="None" radii="300" onClick={dismissPrompt}>
          <Text size="B300">Dismiss</Text>
        </Button>
        <Button size="300" variant="Secondary" fill="None" radii="300" onClick={snoozePrompt}>
          <Text size="B300">Later (1 week)</Text>
        </Button>
        {content.action && (
          <Button size="300" variant="Primary" radii="300" onClick={content.action.onAction}>
            <Text size="B300">{content.action.label}</Text>
          </Button>
        )}
      </Box>
    </Box>
  );
}
