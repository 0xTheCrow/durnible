import { app, BrowserWindow, ipcMain } from 'electron';
import type { IpcMainEvent } from 'electron';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { autoUpdater } from 'electron-updater';

const APP_UPDATE_STATUS_CHANNEL = 'durnible:app-update:status';
const APP_UPDATE_RESTART_CHANNEL = 'durnible:app-update:restart';

const LATEST_RELEASE_URL = 'https://github.com/0xTheCrow/durnible/releases/latest';

const INITIAL_CHECK_DELAY_MS = 30 * 1000;
const RECHECK_INTERVAL_MS = 6 * 60 * 60 * 1000;

type AppUpdateStatus =
  | { availability: 'ready-to-install'; version: string }
  | { availability: 'manual-download'; version: string; releaseUrl: string };

const PACKAGE_TYPE_MARKER_FILENAME = 'package-type';

const checkIsSelfInstallSupported = (): boolean => {
  if (process.platform === 'darwin') return false;
  if (process.platform !== 'linux') return true;
  if (existsSync(path.join(process.resourcesPath, PACKAGE_TYPE_MARKER_FILENAME))) return true;
  return typeof process.env.APPIMAGE === 'string';
};

const broadcastAppUpdateStatus = (status: AppUpdateStatus): void => {
  BrowserWindow.getAllWindows().forEach((browserWindow) => {
    browserWindow.webContents.send(APP_UPDATE_STATUS_CHANNEL, status);
  });
};

export const installAppUpdate = (checkIsTrustedSender: (event: IpcMainEvent) => boolean): void => {
  if (!app.isPackaged) return;

  const isSelfInstallSupported = checkIsSelfInstallSupported();
  autoUpdater.autoDownload = isSelfInstallSupported;
  autoUpdater.autoInstallOnAppQuit = isSelfInstallSupported;

  let availableVersion: string | null = null;

  const broadcastManualDownload = (version: string): void =>
    broadcastAppUpdateStatus({
      availability: 'manual-download',
      version,
      releaseUrl: LATEST_RELEASE_URL,
    });

  autoUpdater.on('update-available', (updateInfo) => {
    availableVersion = updateInfo.version;
    if (isSelfInstallSupported) return;
    broadcastManualDownload(updateInfo.version);
  });

  autoUpdater.on('update-downloaded', (updateInfo) => {
    broadcastAppUpdateStatus({ availability: 'ready-to-install', version: updateInfo.version });
  });

  autoUpdater.on('error', () => {
    if (!availableVersion) return;
    broadcastManualDownload(availableVersion);
  });

  ipcMain.on(APP_UPDATE_RESTART_CHANNEL, (event) => {
    if (!checkIsTrustedSender(event)) return;
    autoUpdater.quitAndInstall();
  });

  const checkForUpdates = (): void => {
    autoUpdater.checkForUpdates().catch(() => undefined);
  };

  setTimeout(checkForUpdates, INITIAL_CHECK_DELAY_MS);
  setInterval(checkForUpdates, RECHECK_INTERVAL_MS);
};
