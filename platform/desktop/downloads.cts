import { ipcMain, shell } from 'electron';
import type { DownloadItem, IpcMainEvent, IpcMainInvokeEvent, Session } from 'electron';
import { randomUUID } from 'node:crypto';
import path from 'node:path';

const DOWNLOAD_STATUS_CHANNEL = 'durnible:download:status';
const DOWNLOAD_SHOW_IN_FOLDER_CHANNEL = 'durnible:download:show-in-folder';
const DOWNLOAD_SAVING_STATUS_DELAY_MS = 150;

type DownloadStatus =
  | { downloadId: string; filename: string; state: 'saving'; percent?: number }
  | { downloadId: string; filename: string; state: 'completed' }
  | { downloadId: string; filename: string; state: 'failed' };

const savePathsByDownloadId = new Map<string, string>();

const getDownloadFilename = (downloadItem: DownloadItem): string => {
  const savePath = downloadItem.getSavePath();
  return savePath ? path.basename(savePath) : downloadItem.getFilename();
};

const getDownloadPercent = (downloadItem: DownloadItem): number | undefined => {
  const totalBytes = downloadItem.getTotalBytes();
  if (totalBytes <= 0) return undefined;
  return Math.floor((downloadItem.getReceivedBytes() / totalBytes) * 100);
};

export const installDownloads = (
  appSession: Session,
  checkIsTrustedSender: (event: IpcMainEvent | IpcMainInvokeEvent) => boolean
): void => {
  appSession.on('will-download', (_event, downloadItem, webContents) => {
    const downloadId = randomUUID();
    let savingStatusTimeout: NodeJS.Timeout | undefined;
    let isReportingProgress = false;
    let lastReportedPercent: number | undefined;

    const sendDownloadStatus = (status: DownloadStatus): void => {
      if (!webContents.isDestroyed()) webContents.send(DOWNLOAD_STATUS_CHANNEL, status);
    };

    const reportSavingProgress = (): void => {
      const percent = getDownloadPercent(downloadItem);
      if (lastReportedPercent !== undefined && percent === lastReportedPercent) return;
      lastReportedPercent = percent;
      sendDownloadStatus({
        downloadId,
        filename: getDownloadFilename(downloadItem),
        state: 'saving',
        percent,
      });
    };

    downloadItem.on('updated', (_updatedEvent, state) => {
      if (state !== 'progressing') return;
      if (isReportingProgress) {
        reportSavingProgress();
        return;
      }
      savingStatusTimeout ??= setTimeout(() => {
        isReportingProgress = true;
        reportSavingProgress();
      }, DOWNLOAD_SAVING_STATUS_DELAY_MS);
    });

    downloadItem.once('done', (_doneEvent, state) => {
      clearTimeout(savingStatusTimeout);
      if (state === 'cancelled') return;
      const filename = getDownloadFilename(downloadItem);
      if (state === 'completed') {
        savePathsByDownloadId.set(downloadId, downloadItem.getSavePath());
        sendDownloadStatus({ downloadId, filename, state: 'completed' });
        return;
      }
      sendDownloadStatus({ downloadId, filename, state: 'failed' });
    });
  });

  ipcMain.on(DOWNLOAD_SHOW_IN_FOLDER_CHANNEL, (event, downloadId: unknown) => {
    if (!checkIsTrustedSender(event) || typeof downloadId !== 'string') return;
    const savePath = savePathsByDownloadId.get(downloadId);
    if (savePath) shell.showItemInFolder(savePath);
  });
};
