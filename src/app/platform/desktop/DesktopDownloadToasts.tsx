import React, { useCallback, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { Box, Icon, IconButton, Icons, Spinner, Text } from 'folds';
import type { DesktopDownloadStatus } from './bridge';
import { showDesktopDownloadInFolder, subscribeDesktopDownloadStatus } from './bridge';
import * as css from './DesktopDownloadToasts.css';

export const DOWNLOAD_TOAST_DURATION_MS = 6000;

type DownloadToastEntry = {
  status: DesktopDownloadStatus;
  isHidden: boolean;
};

const getStatusText = (download: DesktopDownloadStatus): string => {
  switch (download.state) {
    case 'saving':
      return 'Saving…';
    case 'completed':
      return 'Downloaded. Click to show in folder.';
    default:
      return 'Download failed.';
  }
};

type DownloadToastProps = {
  download: DesktopDownloadStatus;
  onDismiss: (downloadId: string) => void;
};

function DownloadToast({ download, onDismiss }: DownloadToastProps) {
  const { downloadId, filename, state } = download;
  const isSaving = state === 'saving';

  useEffect(() => {
    if (isSaving) return undefined;
    const dismissTimeout = setTimeout(() => onDismiss(downloadId), DOWNLOAD_TOAST_DURATION_MS);
    return () => clearTimeout(dismissTimeout);
  }, [downloadId, isSaving, onDismiss]);

  const revealDownload = () => {
    showDesktopDownloadInFolder(downloadId);
    onDismiss(downloadId);
  };

  const summary = (
    <>
      {isSaving ? (
        <Spinner size="200" variant="Secondary" />
      ) : (
        <Icon size="200" src={state === 'completed' ? Icons.Download : Icons.Warning} />
      )}
      <Box direction="Column" style={{ minWidth: 0 }}>
        <Text size="T300" truncate>
          {filename}
        </Text>
        <Text size="T200" priority="300">
          {getStatusText(download)}
          {download.state === 'saving' && download.percent !== undefined && (
            <span aria-hidden>{` ${download.percent}%`}</span>
          )}
        </Text>
      </Box>
    </>
  );

  return (
    <Box
      className={css.DownloadToast}
      gap="100"
      alignItems="Center"
      data-testid="desktop-download-toast"
    >
      {state === 'completed' ? (
        <Box
          as="button"
          type="button"
          className={css.DownloadToastReveal}
          grow="Yes"
          gap="300"
          alignItems="Center"
          onClick={revealDownload}
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

export function DesktopDownloadToasts() {
  const [downloadToasts, setDownloadToasts] = useState<DownloadToastEntry[]>([]);

  useEffect(
    () =>
      subscribeDesktopDownloadStatus((status) =>
        setDownloadToasts((currentToasts) => {
          const existingToast = currentToasts.find(
            (toast) => toast.status.downloadId === status.downloadId
          );
          const updatedToast: DownloadToastEntry = {
            status,
            isHidden: status.state === 'saving' && existingToast?.isHidden === true,
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
          if (toast.status.state === 'saving') return [{ ...toast, isHidden: true }];
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
