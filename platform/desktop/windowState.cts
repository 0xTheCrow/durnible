import { app, screen } from 'electron';
import type { BrowserWindow, Rectangle } from 'electron';
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';

const DEFAULT_WIDTH = 1280;
const DEFAULT_HEIGHT = 800;
const SAVE_DEBOUNCE_MS = 400;

type PersistedWindowState = {
  bounds: Rectangle;
  isMaximized: boolean;
};

const getStateFilePath = (): string => path.join(app.getPath('userData'), 'window-state.json');

const readPersistedState = (): PersistedWindowState | null => {
  try {
    return JSON.parse(readFileSync(getStateFilePath(), 'utf8')) as PersistedWindowState;
  } catch {
    return null;
  }
};

const checkIsBoundsOnScreen = (bounds: Rectangle): boolean =>
  screen.getAllDisplays().some(({ workArea }) => {
    const horizontallyVisible =
      bounds.x < workArea.x + workArea.width && bounds.x + bounds.width > workArea.x;
    const verticallyVisible =
      bounds.y < workArea.y + workArea.height && bounds.y + bounds.height > workArea.y;
    return horizontallyVisible && verticallyVisible;
  });

export const getInitialWindowBounds = (): Partial<Rectangle> => {
  const state = readPersistedState();
  if (state && checkIsBoundsOnScreen(state.bounds)) {
    return state.bounds;
  }
  return { width: DEFAULT_WIDTH, height: DEFAULT_HEIGHT };
};

export const persistWindowState = (browserWindow: BrowserWindow): void => {
  if (readPersistedState()?.isMaximized) {
    browserWindow.maximize();
  }

  let saveTimeout: NodeJS.Timeout | undefined;

  const save = (): void => {
    if (browserWindow.isDestroyed()) return;
    const isMaximized = browserWindow.isMaximized();
    const state: PersistedWindowState = {
      bounds: isMaximized ? browserWindow.getNormalBounds() : browserWindow.getBounds(),
      isMaximized,
    };
    try {
      writeFileSync(getStateFilePath(), JSON.stringify(state));
    } catch {
      // Persisting window state is best-effort.
    }
  };

  const scheduleSave = (): void => {
    clearTimeout(saveTimeout);
    saveTimeout = setTimeout(save, SAVE_DEBOUNCE_MS);
  };

  browserWindow.on('resize', scheduleSave);
  browserWindow.on('move', scheduleSave);
  browserWindow.on('close', () => {
    clearTimeout(saveTimeout);
    save();
  });
};
