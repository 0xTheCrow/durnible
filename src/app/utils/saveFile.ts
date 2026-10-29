import FileSaver from 'file-saver';
import { checkIsNativeMobileApp } from '../platform/mobile';
import { checkIsMobileFileSaveSupported, saveFileOnMobile } from '../platform/mobile/fileSave';
import type { DownloadStatus } from './downloadStatus';
import { reportDownloadStatus } from './downloadStatus';

export const MINIMUM_FILE_SAVE_WEBVIEW_VERSION = 116;

export const DOWNLOAD_STATUS_DELAY_MS = 150;

export class UnsupportedFileSaveError extends Error {
  constructor() {
    super(
      `Saving files needs Android System WebView ${MINIMUM_FILE_SAVE_WEBVIEW_VERSION} or newer. Update it from the Play Store.`
    );
    this.name = 'UnsupportedFileSaveError';
  }
}

export type LoadFileContent = (
  reportPercent: (percent: number | undefined) => void
) => Promise<Blob>;

type InProgressState = 'downloading' | 'saving';

let saveCount = 0;

const createDownloadStatusReporter = (filename: string) => {
  saveCount += 1;
  const downloadId = `save-${saveCount}`;
  let latestProgressStatus: DownloadStatus | undefined;
  let isDelayElapsed = false;
  const delayTimeout = setTimeout(() => {
    isDelayElapsed = true;
    if (latestProgressStatus) reportDownloadStatus(latestProgressStatus);
  }, DOWNLOAD_STATUS_DELAY_MS);

  const reportSettled = (status: DownloadStatus) => {
    clearTimeout(delayTimeout);
    reportDownloadStatus(status);
  };

  return {
    reportProgress: (state: InProgressState, percent: number | undefined) => {
      latestProgressStatus = { downloadId, filename, state, percent };
      if (isDelayElapsed) reportDownloadStatus(latestProgressStatus);
    },
    reportCleared: () => reportSettled({ downloadId, state: 'cleared' }),
    reportCompleted: (savedTo: string) =>
      reportSettled({ downloadId, filename: savedTo, state: 'completed' }),
    reportFailed: () => reportSettled({ downloadId, filename, state: 'failed' }),
  };
};

const loadBlob = async (
  data: Blob | string | LoadFileContent,
  reportPercent: (percent: number | undefined) => void
): Promise<Blob> => {
  if (data instanceof Blob) return data;
  if (typeof data === 'string') {
    const response = await fetch(data);
    return response.blob();
  }
  reportPercent(undefined);
  return data(reportPercent);
};

export const saveFile = async (
  data: Blob | string | LoadFileContent,
  filename: string
): Promise<void> => {
  const isNativeMobileApp = checkIsNativeMobileApp();
  if (isNativeMobileApp && !checkIsMobileFileSaveSupported()) throw new UnsupportedFileSaveError();

  const downloadStatus = createDownloadStatusReporter(filename);
  try {
    const blob = await loadBlob(data, (percent) =>
      downloadStatus.reportProgress('downloading', percent)
    );
    if (!isNativeMobileApp) {
      FileSaver.saveAs(blob, filename);
      downloadStatus.reportCleared();
      return;
    }
    const savedTo = await saveFileOnMobile(blob, filename, (percent) =>
      downloadStatus.reportProgress('saving', percent)
    );
    if (savedTo === undefined) downloadStatus.reportCleared();
    else downloadStatus.reportCompleted(savedTo);
  } catch (error) {
    downloadStatus.reportFailed();
    throw error;
  }
};
