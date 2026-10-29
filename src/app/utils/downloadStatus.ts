import {
  showDesktopDownloadInFolder,
  subscribeDesktopDownloadStatus,
} from '../platform/desktop/bridge';

export type DownloadStatus =
  | { downloadId: string; filename: string; state: 'downloading' | 'saving'; percent?: number }
  | { downloadId: string; filename: string; state: 'completed'; showInFolder?: () => void }
  | { downloadId: string; filename: string; state: 'failed' }
  | { downloadId: string; state: 'cleared' };

type DownloadStatusListener = (status: DownloadStatus) => void;

const downloadStatusListeners = new Set<DownloadStatusListener>();

export const reportDownloadStatus = (status: DownloadStatus): void => {
  downloadStatusListeners.forEach((listener) => listener(status));
};

export const subscribeDownloadStatus = (listener: DownloadStatusListener): (() => void) => {
  downloadStatusListeners.add(listener);
  const unsubscribeDesktop = subscribeDesktopDownloadStatus((desktopStatus) =>
    listener(
      desktopStatus.state === 'completed'
        ? {
            ...desktopStatus,
            showInFolder: () => showDesktopDownloadInFolder(desktopStatus.downloadId),
          }
        : desktopStatus
    )
  );
  return () => {
    downloadStatusListeners.delete(listener);
    unsubscribeDesktop();
  };
};
