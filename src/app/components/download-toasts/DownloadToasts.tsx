import React, { useCallback, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { Box, Icon, IconButton, Icons, Spinner, Text } from 'folds';
import type { DownloadStatus } from '../../utils/downloadStatus';
import { subscribeDownloadStatus } from '../../utils/downloadStatus';
import * as css from './DownloadToasts.css';

export const DOWNLOAD_TOAST_DURATION_MS = 6000;

type ShownDownloadStatus = Exclude<DownloadStatus, { state: 'cleared' }>;

type DownloadToastEntry = {
  status: ShownDownloadStatus;
  isHidden: boolean;
};

const checkIsInProgress = (download: ShownDownloadStatus): boolean =>
  download.state === 'downloading' || download.state === 'saving';

const getStatusText = (download: ShownDownloadStatus): string => {
  switch (download.state) {
    case 'downloading':
      return 'Downloading…';
    case 'saving':
      return 'Saving…';
    case 'completed':
      return download.showInFolder ? 'Downloaded. Click to show in folder.' : 'Saved.';
    default:
      return 'Download failed.';
  }
};

type DownloadToastProps = {
  download: ShownDownloadStatus;
  onDismiss: (downloadId: string) => void;
};

function DownloadToast({ download, onDismiss }: DownloadToastProps) {
  const { downloadId, filename } = download;
  const isInProgress = checkIsInProgress(download);

  useEffect(() => {
    if (isInProgress) return undefined;
    const dismissTimeout = setTimeout(() => onDismiss(downloadId), DOWNLOAD_TOAST_DURATION_MS);
    return () => clearTimeout(dismissTimeout);
  }, [downloadId, isInProgress, onDismiss]);

  const summary = (
    <>
      {isInProgress ? (
        <Spinner size="200" variant="Secondary" />
      ) : (
        <Icon size="200" src={download.state === 'completed' ? Icons.Download : Icons.Warning} />
      )}
      <Box direction="Column" style={{ minWidth: 0 }}>
        <Text size="T300" truncate>
          {filename}
        </Text>
        <Text size="T200" priority="300">
          {getStatusText(download)}
          {(download.state === 'downloading' || download.state === 'saving') &&
            download.percent !== undefined && <span aria-hidden>{` ${download.percent}%`}</span>}
        </Text>
      </Box>
    </>
  );

  const showInFolder = download.state === 'completed' ? download.showInFolder : undefined;

  return (
    <Box className={css.DownloadToast} gap="100" alignItems="Center" data-testid="download-toast">
      {showInFolder ? (
        <Box
          as="button"
          type="button"
          className={css.DownloadToastReveal}
          grow="Yes"
          gap="300"
          alignItems="Center"
          onClick={() => {
            showInFolder();
            onDismiss(downloadId);
          }}
          title="Show in folder"
        >
          {summary}
        </Box>
      ) : (
        <Box className={css.DownloadToastSummary} grow="Yes" gap="300" alignItems="Center">
          {summary}
        </Box>
      )}
      <Box shrink="No">
        <IconButton
          size="300"
          variant="Surface"
          fill="None"
          radii="300"
          onClick={() => onDismiss(downloadId)}
          aria-label="Dismiss download message"
        >
          <Icon size="100" src={Icons.Cross} />
        </IconButton>
      </Box>
    </Box>
  );
}

export function DownloadToasts() {
  const [downloadToasts, setDownloadToasts] = useState<DownloadToastEntry[]>([]);

  useEffect(
    () =>
      subscribeDownloadStatus((status) =>
        setDownloadToasts((currentToasts) => {
          if (status.state === 'cleared') {
            return currentToasts.filter((toast) => toast.status.downloadId !== status.downloadId);
          }
          const existingToast = currentToasts.find(
            (toast) => toast.status.downloadId === status.downloadId
          );
          const updatedToast: DownloadToastEntry = {
            status,
            isHidden: checkIsInProgress(status) && existingToast?.isHidden === true,
          };
          if (!existingToast) return [...currentToasts, updatedToast];
          return currentToasts.map((toast) => (toast === existingToast ? updatedToast : toast));
        })
      ),
    []
  );

  const dismissDownload = useCallback(
    (downloadId: string) =>
      setDownloadToasts((currentToasts) =>
        currentToasts.flatMap((toast) => {
          if (toast.status.downloadId !== downloadId) return [toast];
          if (checkIsInProgress(toast.status)) return [{ ...toast, isHidden: true }];
          return [];
        })
      ),
    []
  );

  return createPortal(
    <Box
      className={css.DownloadToastStack}
      direction="Column"
      alignItems="Center"
      gap="200"
      role="status"
      aria-atomic="false"
    >
      {downloadToasts
        .filter((toast) => !toast.isHidden)
        .map((toast) => (
          <DownloadToast
            key={toast.status.downloadId}
            download={toast.status}
            onDismiss={dismissDownload}
          />
        ))}
    </Box>,
    document.body
  );
}
