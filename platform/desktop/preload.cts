import { contextBridge, ipcRenderer } from 'electron';
import type { IpcRendererEvent } from 'electron';

const MEDIA_AUTH_IPC_CHANNEL = 'durnible:media-auth:set';
const DEVTOOLS_ENABLED_IPC_CHANNEL = 'durnible:devtools-enabled:set';
const SCREENSHARE_SOURCE_REQUEST_CHANNEL = 'durnible:screenshare:source-request';
const SCREENSHARE_SOURCE_RESPONSE_CHANNEL = 'durnible:screenshare:source-response';
const APP_UPDATE_STATUS_CHANNEL = 'durnible:app-update:status';
const APP_UPDATE_CURRENT_STATUS_CHANNEL = 'durnible:app-update:current-status';
const APP_UPDATE_CHECK_CHANNEL = 'durnible:app-update:check';
const APP_UPDATE_INSTALL_CHANNEL = 'durnible:app-update:install';
const APP_UPDATE_CANCEL_DOWNLOAD_CHANNEL = 'durnible:app-update:cancel-download';

type MediaAuthConfig = {
  homeserverBaseUrl: string | null;
  accessToken: string | null;
};

type ScreenshareSource = {
  id: string;
  name: string;
  thumbnailDataUrl: string;
  isScreen: boolean;
};

type ScreenshareSourceRequest = {
  requestId: string;
  sources: ScreenshareSource[];
};

type ScreenshareSourceChoice = {
  sourceId: string;
  shareSystemAudio: boolean;
};

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

contextBridge.exposeInMainWorld('durnibleDesktop', {
  isDesktop: true,
  platform: process.platform,
  setMediaAuth: (config: MediaAuthConfig): void => {
    ipcRenderer.send(MEDIA_AUTH_IPC_CHANNEL, config);
  },
  setDevToolsEnabled: (enabled: boolean): void => {
    ipcRenderer.send(DEVTOOLS_ENABLED_IPC_CHANNEL, enabled);
  },
  onScreenshareSourceRequest: (
    handler: (request: ScreenshareSourceRequest) => void
  ): (() => void) => {
    const listener = (_event: IpcRendererEvent, request: ScreenshareSourceRequest): void =>
      handler(request);
    ipcRenderer.on(SCREENSHARE_SOURCE_REQUEST_CHANNEL, listener);
    return () => ipcRenderer.removeListener(SCREENSHARE_SOURCE_REQUEST_CHANNEL, listener);
  },
  respondScreenshareSource: (requestId: string, choice: ScreenshareSourceChoice | null): void => {
    ipcRenderer.send(SCREENSHARE_SOURCE_RESPONSE_CHANNEL, { requestId, choice });
  },
  onAppUpdateStatus: (handler: (status: AppUpdateStatus) => void): (() => void) => {
    const listener = (_event: IpcRendererEvent, status: AppUpdateStatus): void => handler(status);
    ipcRenderer.on(APP_UPDATE_STATUS_CHANNEL, listener);
    return () => ipcRenderer.removeListener(APP_UPDATE_STATUS_CHANNEL, listener);
  },
  getAppUpdateStatus: (): Promise<AppUpdateStatus> =>
    ipcRenderer.invoke(APP_UPDATE_CURRENT_STATUS_CHANNEL),
  checkForAppUpdate: (): void => {
    ipcRenderer.send(APP_UPDATE_CHECK_CHANNEL);
  },
  installAppUpdate: (): void => {
    ipcRenderer.send(APP_UPDATE_INSTALL_CHANNEL);
  },
  cancelAppUpdateDownload: (): void => {
    ipcRenderer.send(APP_UPDATE_CANCEL_DOWNLOAD_CHANNEL);
  },
});
