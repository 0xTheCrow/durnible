import { app, BrowserWindow, ipcMain, protocol, screen, session, shell } from 'electron';
import type { IpcMainEvent, IpcMainInvokeEvent } from 'electron';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { installAppUpdate } from './appUpdate.cjs';
import { installTextContextMenu } from './contextMenu.cjs';
import { installMediaAuthResponseHeaders, setMediaAuth } from './mediaAuth.cjs';
import { installRequestHeaders } from './requestHeaders.cjs';
import { enableScreenshareLoopbackFeatures, installScreenshareAudio } from './screenshareAudio.cjs';
import { getInitialWindowBounds, persistWindowState } from './windowState.cjs';

const APP_SCHEME = 'app';
const APP_HOST = 'durnible';
const APP_ORIGIN = `${APP_SCHEME}://${APP_HOST}`;
const MEDIA_AUTH_IPC_CHANNEL = 'durnible:media-auth:set';
const DEVTOOLS_ENABLED_IPC_CHANNEL = 'durnible:devtools-enabled:set';
const CALL_POP_OUT_DRAG_START_CHANNEL = 'durnible:call-pop-out:drag-start';
const CALL_POP_OUT_DRAG_MOVE_CHANNEL = 'durnible:call-pop-out:drag-move';
const CALL_POP_OUT_DRAG_END_CHANNEL = 'durnible:call-pop-out:drag-end';
const CALL_POP_OUT_WINDOW_NAME_PREFIX = 'durnible-call-pop-out-';
const CALL_POP_OUT_MIN_WIDTH_PX = 160;
const CALL_POP_OUT_MIN_HEIGHT_PX = 90;

const webBuildDirectory = path.join(__dirname, '..', '..', '..', 'dist');
const indexHtmlPath = path.join(webBuildDirectory, 'index.html');
const appIconPath = path.join(
  webBuildDirectory,
  'public',
  'res',
  'android',
  'android-chrome-512x512.png'
);

const GRANTED_PERMISSIONS = new Set([
  'media',
  'display-capture',
  'notifications',
  'clipboard-sanitized-write',
  'fullscreen',
]);

const contentTypeByExtension: Record<string, string> = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.mjs': 'text/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.wasm': 'application/wasm',
  '.map': 'application/json',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.avif': 'image/avif',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.txt': 'text/plain',
  '.wav': 'audio/wav',
  '.ogg': 'audio/ogg',
  '.mp3': 'audio/mpeg',
  '.webm': 'video/webm',
  '.mp4': 'video/mp4',
};

protocol.registerSchemesAsPrivileged([
  {
    scheme: APP_SCHEME,
    privileges: {
      standard: true,
      secure: true,
      allowServiceWorkers: true,
      supportFetchAPI: true,
      corsEnabled: true,
      stream: true,
    },
  },
]);

enableScreenshareLoopbackFeatures();

const resolveWebBuildFile = (requestUrl: string): string => {
  const { pathname } = new URL(requestUrl);
  const requestedFile = path.normalize(path.join(webBuildDirectory, decodeURIComponent(pathname)));
  if (
    requestedFile !== webBuildDirectory &&
    !requestedFile.startsWith(webBuildDirectory + path.sep)
  ) {
    return indexHtmlPath;
  }
  return requestedFile;
};

const serveWebBuild = async (request: Request): Promise<Response> => {
  let filePath = resolveWebBuildFile(request.url);
  let fileBytes: Buffer;
  try {
    fileBytes = await readFile(filePath);
  } catch {
    filePath = indexHtmlPath;
    fileBytes = await readFile(indexHtmlPath);
  }
  const contentType =
    contentTypeByExtension[path.extname(filePath).toLowerCase()] ?? 'application/octet-stream';
  return new Response(new Uint8Array(fileBytes), { headers: { 'content-type': contentType } });
};

const checkIsRendererFrame = (frameUrl: string | undefined): boolean =>
  typeof frameUrl === 'string' && frameUrl.startsWith(`${APP_ORIGIN}/`);

const checkIsTrustedSender = (event: IpcMainEvent | IpcMainInvokeEvent): boolean => {
  const { senderFrame } = event;
  return !!senderFrame && !senderFrame.parent && checkIsRendererFrame(senderFrame.url);
};

const registerMediaAuthChannel = (): void => {
  ipcMain.on(MEDIA_AUTH_IPC_CHANNEL, (event, payload: unknown) => {
    if (!checkIsTrustedSender(event)) return;
    const config = (payload ?? {}) as Record<string, unknown>;
    setMediaAuth(config.homeserverBaseUrl, config.accessToken);
  });
};

const registerDevToolsMenuChannel = (): void => {
  ipcMain.on(DEVTOOLS_ENABLED_IPC_CHANNEL, (event, payload: unknown) => {
    if (!checkIsTrustedSender(event)) return;
    const isDevToolsEnabled = payload === true;
    BrowserWindow.getAllWindows().forEach((browserWindow) => {
      browserWindow.setMenuBarVisibility(isDevToolsEnabled);
    });
  });
};

let callPopOutWindow: BrowserWindow | undefined;
type CallPopOutDrag = {
  cursorOffsetX: number;
  cursorOffsetY: number;
  width: number;
  height: number;
};

let callPopOutDrag: CallPopOutDrag | undefined;

const getLiveCallPopOutWindow = (): BrowserWindow | undefined =>
  callPopOutWindow && !callPopOutWindow.isDestroyed() ? callPopOutWindow : undefined;

const registerCallPopOutDragChannels = (): void => {
  ipcMain.on(CALL_POP_OUT_DRAG_START_CHANNEL, (event) => {
    const popOutWindow = getLiveCallPopOutWindow();
    if (!checkIsTrustedSender(event) || !popOutWindow) return;
    const cursorPoint = screen.getCursorScreenPoint();
    const windowBounds = popOutWindow.getBounds();
    callPopOutDrag = {
      cursorOffsetX: cursorPoint.x - windowBounds.x,
      cursorOffsetY: cursorPoint.y - windowBounds.y,
      width: windowBounds.width,
      height: windowBounds.height,
    };
  });
  ipcMain.on(CALL_POP_OUT_DRAG_MOVE_CHANNEL, (event) => {
    const popOutWindow = getLiveCallPopOutWindow();
    if (!checkIsTrustedSender(event) || !popOutWindow || !callPopOutDrag) return;
    const cursorPoint = screen.getCursorScreenPoint();
    popOutWindow.setBounds({
      x: cursorPoint.x - callPopOutDrag.cursorOffsetX,
      y: cursorPoint.y - callPopOutDrag.cursorOffsetY,
      width: callPopOutDrag.width,
      height: callPopOutDrag.height,
    });
  });
  ipcMain.on(CALL_POP_OUT_DRAG_END_CHANNEL, (event) => {
    if (!checkIsTrustedSender(event)) return;
    callPopOutDrag = undefined;
  });
};

const createMainWindow = (): void => {
  const mainWindow = new BrowserWindow({
    ...getInitialWindowBounds(),
    minWidth: 640,
    minHeight: 480,
    backgroundColor: '#000000',
    icon: appIconPath,
    show: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      spellcheck: true,
      disableHtmlFullscreenWindowResize: true,
    },
  });

  persistWindowState(mainWindow);
  mainWindow.setMenuBarVisibility(false);
  installTextContextMenu(mainWindow.webContents);

  // This is needed to prevent video fullscreen from breaking
  let isWindowFullScreenBeforeHtmlFullscreen = false;
  mainWindow.on('enter-html-full-screen', () => {
    isWindowFullScreenBeforeHtmlFullscreen = mainWindow.isFullScreen();
    if (isWindowFullScreenBeforeHtmlFullscreen) return;
    setImmediate(() => {
      if (!mainWindow.isDestroyed()) mainWindow.setFullScreen(true);
    });
  });
  mainWindow.on('leave-html-full-screen', () => {
    if (isWindowFullScreenBeforeHtmlFullscreen) return;
    setImmediate(() => {
      if (!mainWindow.isDestroyed()) mainWindow.setFullScreen(false);
    });
  });

  mainWindow.once('ready-to-show', () => mainWindow.show());

  mainWindow.webContents.setWindowOpenHandler(({ url, frameName }) => {
    if (frameName.startsWith(CALL_POP_OUT_WINDOW_NAME_PREFIX) && url === 'about:blank') {
      return {
        action: 'allow',
        overrideBrowserWindowOptions: {
          frame: false,
          alwaysOnTop: true,
          skipTaskbar: true,
          backgroundColor: '#000000',
          minWidth: CALL_POP_OUT_MIN_WIDTH_PX,
          minHeight: CALL_POP_OUT_MIN_HEIGHT_PX,
          icon: appIconPath,
        },
      };
    }
    if (url.startsWith('http:') || url.startsWith('https:') || url.startsWith('mailto:')) {
      shell.openExternal(url);
    }
    return { action: 'deny' };
  });

  mainWindow.webContents.on('did-create-window', (popOutWindow) => {
    callPopOutWindow = popOutWindow;
    popOutWindow.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
    popOutWindow.webContents.on('will-navigate', (event) => event.preventDefault());
  });

  mainWindow.webContents.on('will-navigate', (event, url) => {
    if (!url.startsWith(`${APP_ORIGIN}/`)) {
      event.preventDefault();
    }
  });

  mainWindow.loadURL(`${APP_ORIGIN}/`);
};

if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on('second-instance', () => {
    const [existingWindow] = BrowserWindow.getAllWindows();
    if (!existingWindow) return;
    if (existingWindow.isMinimized()) existingWindow.restore();
    existingWindow.focus();
  });

  app.whenReady().then(() => {
    const appSession = session.defaultSession;

    appSession.setPermissionRequestHandler((_webContents, permission, callback) => {
      callback(GRANTED_PERMISSIONS.has(permission));
    });
    appSession.setPermissionCheckHandler((_webContents, permission) =>
      GRANTED_PERMISSIONS.has(permission)
    );

    installRequestHeaders(appSession);
    installMediaAuthResponseHeaders(appSession);
    installScreenshareAudio(appSession, checkIsRendererFrame);
    registerMediaAuthChannel();
    registerDevToolsMenuChannel();
    registerCallPopOutDragChannels();
    installAppUpdate(checkIsTrustedSender);

    protocol.handle(APP_SCHEME, serveWebBuild);
    createMainWindow();

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) createMainWindow();
    });
  });

  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
  });
}
