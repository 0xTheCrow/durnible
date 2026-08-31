import { app, BrowserWindow, ipcMain, protocol, session, shell } from 'electron';
import type { IpcMainEvent } from 'electron';
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

const checkIsTrustedSender = (event: IpcMainEvent): boolean => {
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
    },
  });

  persistWindowState(mainWindow);
  mainWindow.setMenuBarVisibility(false);
  installTextContextMenu(mainWindow.webContents);

  mainWindow.once('ready-to-show', () => mainWindow.show());

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('http:') || url.startsWith('https:') || url.startsWith('mailto:')) {
      shell.openExternal(url);
    }
    return { action: 'deny' };
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
