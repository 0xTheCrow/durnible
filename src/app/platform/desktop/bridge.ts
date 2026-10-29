export type DesktopMediaAuthConfig = {
  homeserverBaseUrl: string | null;
  accessToken: string | null;
};

export type DesktopScreenshareSource = {
  id: string;
  name: string;
  thumbnailDataUrl: string;
  isScreen: boolean;
};

export type DesktopScreenshareSourceRequest = {
  requestId: string;
  sources: DesktopScreenshareSource[];
};

export type DesktopScreenshareSourceChoice = {
  sourceId: string;
  shareSystemAudio: boolean;
};

export type DesktopAppUpdateStatus =
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

export type DesktopVideoTranscodeResult =
  | { status: 'success'; bytes: Uint8Array }
  | { status: 'ffmpeg-missing' }
  | { status: 'failed' }
  | { status: 'cancelled' };

export type DesktopDownloadStatus =
  | { downloadId: string; filename: string; state: 'saving'; percent?: number }
  | { downloadId: string; filename: string; state: 'completed' }
  | { downloadId: string; filename: string; state: 'failed' };

type DesktopBridge = {
  isDesktop: true;
  platform: string;
  setMediaAuth: (config: DesktopMediaAuthConfig) => void;
  setDevToolsEnabled: (enabled: boolean) => void;
  onScreenshareSourceRequest: (
    handler: (request: DesktopScreenshareSourceRequest) => void
  ) => () => void;
  respondScreenshareSource: (
    requestId: string,
    choice: DesktopScreenshareSourceChoice | null
  ) => void;
  onAppUpdateStatus: (handler: (status: DesktopAppUpdateStatus) => void) => () => void;
  getAppUpdateStatus: () => Promise<DesktopAppUpdateStatus>;
  checkForAppUpdate: () => void;
  installAppUpdate: () => void;
  cancelAppUpdateDownload: () => void;
  startCallPopOutWindowDrag: () => void;
  dragCallPopOutWindow: () => void;
  endCallPopOutWindowDrag: () => void;
  transcodeVideo: (
    requestId: string,
    inputBytes: Uint8Array
  ) => Promise<DesktopVideoTranscodeResult>;
  cancelVideoTranscode: (requestId: string) => void;
  onDownloadStatus: (handler: (status: DesktopDownloadStatus) => void) => () => void;
  showDownloadInFolder: (downloadId: string) => void;
};

declare global {
  interface Window {
    durnibleDesktop?: DesktopBridge;
  }
}

const getDesktopBridge = (): DesktopBridge | undefined =>
  typeof window !== 'undefined' ? window.durnibleDesktop : undefined;

export const checkIsDesktopApp = (): boolean => getDesktopBridge()?.isDesktop === true;

export const checkIsDesktopLinuxApp = (): boolean => getDesktopBridge()?.platform === 'linux';

export const syncDesktopMediaAuth = (): void => {
  const bridge = getDesktopBridge();
  if (!bridge) return;
  bridge.setMediaAuth({
    homeserverBaseUrl: localStorage.getItem('cinny_hs_base_url'),
    accessToken: localStorage.getItem('cinny_access_token'),
  });
};

export const subscribeDesktopScreenshareSourceRequest = (
  handler: (request: DesktopScreenshareSourceRequest) => void
): (() => void) => {
  const bridge = getDesktopBridge();
  if (!bridge) return () => undefined;
  return bridge.onScreenshareSourceRequest(handler);
};

export const respondDesktopScreenshareSource = (
  requestId: string,
  choice: DesktopScreenshareSourceChoice | null
): void => {
  getDesktopBridge()?.respondScreenshareSource(requestId, choice);
};

export const startDesktopCallPopOutWindowDrag = (): void => {
  getDesktopBridge()?.startCallPopOutWindowDrag();
};

export const dragDesktopCallPopOutWindow = (): void => {
  getDesktopBridge()?.dragCallPopOutWindow();
};

export const endDesktopCallPopOutWindowDrag = (): void => {
  getDesktopBridge()?.endCallPopOutWindowDrag();
};

export const setDesktopDevToolsEnabled = (enabled: boolean): void => {
  getDesktopBridge()?.setDevToolsEnabled(enabled);
};

export const subscribeDesktopAppUpdateStatus = (
  handler: (status: DesktopAppUpdateStatus) => void
): (() => void) => {
  const bridge = getDesktopBridge();
  if (!bridge) return () => undefined;
  return bridge.onAppUpdateStatus(handler);
};

export const getDesktopAppUpdateStatus = async (): Promise<DesktopAppUpdateStatus> => {
  const bridge = getDesktopBridge();
  if (!bridge) return { availability: 'unsupported' };
  return bridge.getAppUpdateStatus();
};

export const checkForDesktopAppUpdate = (): void => {
  getDesktopBridge()?.checkForAppUpdate();
};

export const installDesktopAppUpdate = (): void => {
  getDesktopBridge()?.installAppUpdate();
};

export const cancelDesktopAppUpdateDownload = (): void => {
  getDesktopBridge()?.cancelAppUpdateDownload();
};

export const subscribeDesktopDownloadStatus = (
  handler: (status: DesktopDownloadStatus) => void
): (() => void) => {
  const bridge = getDesktopBridge();
  if (!bridge) return () => undefined;
  return bridge.onDownloadStatus(handler);
};

export const showDesktopDownloadInFolder = (downloadId: string): void => {
  getDesktopBridge()?.showDownloadInFolder(downloadId);
};

export const transcodeDesktopVideo = async (
  video: Blob,
  signal: AbortSignal
): Promise<DesktopVideoTranscodeResult> => {
  const bridge = getDesktopBridge();
  if (!bridge) return { status: 'failed' };
  const inputBytes = new Uint8Array(await video.arrayBuffer());
  if (signal.aborted) return { status: 'cancelled' };
  const requestId = crypto.randomUUID();
  const cancelTranscode = () => bridge.cancelVideoTranscode(requestId);
  signal.addEventListener('abort', cancelTranscode, { once: true });
  try {
    return await bridge.transcodeVideo(requestId, inputBytes);
  } finally {
    signal.removeEventListener('abort', cancelTranscode);
  }
};
