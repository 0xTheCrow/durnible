import { app, BrowserWindow, ipcMain } from 'electron';
import type { IpcMainEvent, IpcMainInvokeEvent } from 'electron';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { autoUpdater, CancellationToken } from 'electron-updater';

const APP_UPDATE_STATUS_CHANNEL = 'durnible:app-update:status';
const APP_UPDATE_CURRENT_STATUS_CHANNEL = 'durnible:app-update:current-status';
const APP_UPDATE_CHECK_CHANNEL = 'durnible:app-update:check';
const APP_UPDATE_INSTALL_CHANNEL = 'durnible:app-update:install';
const APP_UPDATE_CANCEL_DOWNLOAD_CHANNEL = 'durnible:app-update:cancel-download';

const LATEST_RELEASE_URL = 'https://github.com/0xTheCrow/durnible/releases/latest';

const INITIAL_CHECK_DELAY_MS = 30 * 1000;
const RECHECK_INTERVAL_MS = 6 * 60 * 60 * 1000;

type AppUpdateStatus =
  | { availability: 'unsupported' }
  | { availability: 'unknown' }
  | { availability: 'checking' }
  | { availability: 'up-to-date' }
  | { availability: 'available'; version: string }
  | { availability: 'downloading'; version: string; percent: number }
  | { availability: 'installing'; version: string }
  | { availability: 'install-failed'; version: string; message: string }
  | { availability: 'manual-download'; version: string; releaseUrl: string; message?: string }
  | { availability: 'check-failed'; message: string };

const CHECKABLE_AVAILABILITIES: ReadonlySet<AppUpdateStatus['availability']> = new Set([
  'unknown',
  'up-to-date',
  'manual-download',
  'check-failed',
]);

const AUTHORIZATION_EXIT_MESSAGES: Record<string, string> = {
  '126': 'The password prompt was dismissed.',
  '127': 'Durnible was not authorized to install the update.',
};

const describeInstallFailure = (message: string): string => {
  const exitCode = /exited with code (\d+)/.exec(message)?.[1];
  if (!exitCode) return message;
  return AUTHORIZATION_EXIT_MESSAGES[exitCode] ?? message;
};

const PACKAGE_TYPE_MARKER_FILENAME = 'package-type';

const checkIsSelfInstallSupported = (): boolean => {
  if (process.platform === 'darwin') return false;
  if (process.platform !== 'linux') return true;
  if (existsSync(path.join(process.resourcesPath, PACKAGE_TYPE_MARKER_FILENAME))) return true;
  return typeof process.env.APPIMAGE === 'string';
};

let currentStatus: AppUpdateStatus = { availability: 'unsupported' };

const setAppUpdateStatus = (status: AppUpdateStatus): void => {
  currentStatus = status;
  BrowserWindow.getAllWindows().forEach((browserWindow) => {
    browserWindow.webContents.send(APP_UPDATE_STATUS_CHANNEL, status);
  });
};

export const installAppUpdate = (
  checkIsTrustedSender: (event: IpcMainEvent | IpcMainInvokeEvent) => boolean
): void => {
  ipcMain.handle(APP_UPDATE_CURRENT_STATUS_CHANNEL, (event): AppUpdateStatus => {
    if (!checkIsTrustedSender(event)) return { availability: 'unsupported' };
    return currentStatus;
  });

  if (!app.isPackaged) return;

  currentStatus = { availability: 'unknown' };

  const isSelfInstallSupported = checkIsSelfInstallSupported();
  autoUpdater.autoDownload = false;
  autoUpdater.autoInstallOnAppQuit = false;

  let availableVersion: string | null = null;
  let recheckIntervalId: ReturnType<typeof setInterval> | undefined;
  let downloadCancellationToken: CancellationToken | undefined;

  const setManualDownloadStatus = (version: string, message?: string): void =>
    setAppUpdateStatus({
      availability: 'manual-download',
      version,
      releaseUrl: LATEST_RELEASE_URL,
      message,
    });

  autoUpdater.on('checking-for-update', () => {
    setAppUpdateStatus({ availability: 'checking' });
  });

  autoUpdater.on('update-not-available', () => {
    setAppUpdateStatus({ availability: 'up-to-date' });
  });

  autoUpdater.on('update-available', (updateInfo) => {
    availableVersion = updateInfo.version;
    if (!isSelfInstallSupported) {
      setManualDownloadStatus(updateInfo.version);
      return;
    }
    setAppUpdateStatus({ availability: 'available', version: updateInfo.version });
  });

  autoUpdater.on('download-progress', (progressInfo) => {
    if (!availableVersion) return;
    setAppUpdateStatus({
      availability: 'downloading',
      version: availableVersion,
      percent: progressInfo.percent,
    });
  });

  const startInstall = (version: string): void => {
    setAppUpdateStatus({ availability: 'installing', version });
    setImmediate(() => autoUpdater.quitAndInstall());
  };

  autoUpdater.on('update-downloaded', (updateInfo) => {
    clearInterval(recheckIntervalId);
    startInstall(updateInfo.version);
  });

  autoUpdater.on('error', (error) => {
    const message = error.message || 'Unknown error';
    if (currentStatus.availability === 'installing') {
      setAppUpdateStatus({
        availability: 'install-failed',
        version: currentStatus.version,
        message: describeInstallFailure(message),
      });
      return;
    }
    if (availableVersion) {
      setManualDownloadStatus(availableVersion, message);
      return;
    }
    setAppUpdateStatus({ availability: 'check-failed', message });
  });

  const checkForUpdates = (): void => {
    if (!CHECKABLE_AVAILABILITIES.has(currentStatus.availability)) return;
    autoUpdater.checkForUpdates().catch(() => undefined);
  };

  ipcMain.on(APP_UPDATE_CHECK_CHANNEL, (event) => {
    if (!checkIsTrustedSender(event)) return;
    checkForUpdates();
  });

  ipcMain.on(APP_UPDATE_INSTALL_CHANNEL, (event) => {
    if (!checkIsTrustedSender(event)) return;
    const status = currentStatus;
    if (status.availability === 'install-failed') {
      startInstall(status.version);
      return;
    }
    if (status.availability !== 'available') return;
    downloadCancellationToken = new CancellationToken();
    setAppUpdateStatus({ availability: 'downloading', version: status.version, percent: 0 });
    autoUpdater.downloadUpdate(downloadCancellationToken).catch(() => undefined);
  });

  ipcMain.on(APP_UPDATE_CANCEL_DOWNLOAD_CHANNEL, (event) => {
    if (!checkIsTrustedSender(event)) return;
    const status = currentStatus;
    if (status.availability !== 'downloading') return;
    downloadCancellationToken?.cancel();
    downloadCancellationToken = undefined;
    setAppUpdateStatus({ availability: 'available', version: status.version });
  });

  setTimeout(checkForUpdates, INITIAL_CHECK_DELAY_MS);
  recheckIntervalId = setInterval(checkForUpdates, RECHECK_INTERVAL_MS);
};
