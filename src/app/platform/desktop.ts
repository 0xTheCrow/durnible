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
};

declare global {
  interface Window {
    durnibleDesktop?: DesktopBridge;
  }
}

const getDesktopBridge = (): DesktopBridge | undefined =>
  typeof window !== 'undefined' ? window.durnibleDesktop : undefined;

export const checkIsDesktopApp = (): boolean => getDesktopBridge()?.isDesktop === true;

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

export const setDesktopDevToolsEnabled = (enabled: boolean): void => {
  getDesktopBridge()?.setDevToolsEnabled(enabled);
};
