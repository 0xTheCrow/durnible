import { app, desktopCapturer, ipcMain, webContents } from 'electron';
import type { IpcMainEvent, Session, Streams, WebContents } from 'electron';
import { randomUUID } from 'node:crypto';

const CHROMIUM_ENABLE_FEATURES_SWITCH = 'enable-features';

const SCREENSHARE_LOOPBACK_CHROMIUM_FEATURES = [
  'PulseaudioLoopbackForScreenShare',
  'MacLoopbackAudioForScreenShare',
  'MacSckSystemAudioLoopbackOverride',
];

const SOURCE_REQUEST_CHANNEL = 'durnible:screenshare:source-request';
const SOURCE_RESPONSE_CHANNEL = 'durnible:screenshare:source-response';

const SOURCE_THUMBNAIL_SIZE = { width: 320, height: 180 };
const SOURCE_PICK_TIMEOUT_MS = 2 * 60 * 1000;

type ScreenshareSource = {
  id: string;
  name: string;
  thumbnailDataUrl: string;
  isScreen: boolean;
};

type ScreenshareSourceChoice = {
  sourceId: string;
  shareSystemAudio: boolean;
};

export const enableScreenshareLoopbackFeatures = (): void => {
  const existingFeatures = app.commandLine.getSwitchValue(CHROMIUM_ENABLE_FEATURES_SWITCH);
  const mergedFeatures = [
    ...existingFeatures.split(',').filter(Boolean),
    ...SCREENSHARE_LOOPBACK_CHROMIUM_FEATURES,
  ];
  if (app.commandLine.hasSwitch(CHROMIUM_ENABLE_FEATURES_SWITCH)) {
    app.commandLine.removeSwitch(CHROMIUM_ENABLE_FEATURES_SWITCH);
  }
  app.commandLine.appendSwitch(CHROMIUM_ENABLE_FEATURES_SWITCH, mergedFeatures.join(','));
};

const requestSourceChoiceFromRenderer = (
  targetWebContents: WebContents,
  sources: ScreenshareSource[]
): Promise<ScreenshareSourceChoice | null> =>
  new Promise((resolve) => {
    const requestId = randomUUID();
    let isSettled = false;

    const settle = (choice: ScreenshareSourceChoice | null) => {
      if (isSettled) return;
      isSettled = true;
      clearTimeout(timeoutHandle);
      ipcMain.removeListener(SOURCE_RESPONSE_CHANNEL, handleResponse);
      targetWebContents.removeListener('destroyed', handleWebContentsDestroyed);
      resolve(choice);
    };

    const handleResponse = (event: IpcMainEvent, payload: unknown) => {
      if (event.sender !== targetWebContents) return;
      if (!event.senderFrame || event.senderFrame.parent) return;
      const response = (payload ?? {}) as Record<string, unknown>;
      if (response.requestId !== requestId) return;

      const choice = (response.choice ?? null) as Record<string, unknown> | null;
      if (!choice || typeof choice.sourceId !== 'string') {
        settle(null);
        return;
      }
      settle({
        sourceId: choice.sourceId,
        shareSystemAudio: choice.shareSystemAudio === true,
      });
    };

    const handleWebContentsDestroyed = () => settle(null);
    const timeoutHandle = setTimeout(() => settle(null), SOURCE_PICK_TIMEOUT_MS);

    ipcMain.on(SOURCE_RESPONSE_CHANNEL, handleResponse);
    targetWebContents.once('destroyed', handleWebContentsDestroyed);
    targetWebContents.send(SOURCE_REQUEST_CHANNEL, { requestId, sources });
  });

export const installScreenshareAudio = (
  targetSession: Session,
  checkIsTrustedTopFrameUrl: (frameUrl: string | undefined) => boolean
): void => {
  targetSession.setDisplayMediaRequestHandler(
    async (request, callback) => {
      const requestingFrame = request.frame;
      if (
        !requestingFrame ||
        requestingFrame.parent ||
        !checkIsTrustedTopFrameUrl(requestingFrame.url)
      ) {
        callback({});
        return;
      }
      const requestingWebContents = webContents.fromFrame(requestingFrame);
      if (!requestingWebContents || requestingWebContents.isDestroyed()) {
        callback({});
        return;
      }

      let capturerSources;
      try {
        capturerSources = await desktopCapturer.getSources({
          types: ['screen', 'window'],
          thumbnailSize: SOURCE_THUMBNAIL_SIZE,
        });
      } catch {
        callback({});
        return;
      }

      const sources: ScreenshareSource[] = capturerSources.map((source) => ({
        id: source.id,
        name: source.name,
        thumbnailDataUrl: source.thumbnail.toDataURL(),
        isScreen: source.id.startsWith('screen:'),
      }));

      const choice = await requestSourceChoiceFromRenderer(requestingWebContents, sources);
      const chosenSource = choice
        ? capturerSources.find((source) => source.id === choice.sourceId)
        : undefined;
      if (!choice || !chosenSource) {
        callback({});
        return;
      }

      const streams: Streams = { video: chosenSource };
      if (choice.shareSystemAudio) {
        streams.audio = 'loopback';
      }
      callback(streams);
    },
    { useSystemPicker: false }
  );
};
