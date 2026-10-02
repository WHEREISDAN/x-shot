import path from 'path';
import { app, BrowserWindow, Menu, screen } from 'electron';
import { getLogger } from './logger';
import { markCaptureStage } from './capture-diagnostics';
import { flushPreferencesOnClose } from './preferences-flush';
import { trackWindowState } from './window-state';
import { resolveHtmlPath } from './util';
import getResourcesPath from '../shared/utils';

let mainWindow: BrowserWindow | null = null;
let preferencesWindow: BrowserWindow | null = null;
let screenshotWindows: BrowserWindow[] = [];
// Set while a capture has hidden the Preferences window.
let preferencesHiddenForCapture = false;

// Time for the compositor to drop a hidden or closed window from screen.
const COMPOSITOR_FRAME_MS = 60;
const WINDOW_EVENT_TIMEOUT_MS = 1000;

const nextFrame = () =>
  new Promise<void>((resolve) => {
    setTimeout(resolve, COMPOSITOR_FRAME_MS);
  });

const isDevelopment = () =>
  process.env.NODE_ENV === 'development' || process.env.DEBUG_PROD === 'true';

function addInspectElementMenu(win: BrowserWindow): void {
  win.webContents.on('context-menu', (_event, { x, y }) => {
    Menu.buildFromTemplate([
      {
        label: 'Inspect element',
        click: () => win.webContents.inspectElement(x, y),
      },
    ]).popup({ window: win });
  });
}

export function createMainWindow(): BrowserWindow {
  const RESOURCES_PATH = getResourcesPath();
  const getAssetPath = (...paths: string[]): string =>
    path.join(RESOURCES_PATH, ...paths);

  const win = new BrowserWindow({
    show: false,
    width: 1425,
    height: 980,
    icon: getAssetPath('icon.png'),
    titleBarStyle: 'hidden',
    titleBarOverlay: {
      color: '#111111',
      symbolColor: '#ffffff',
      height: 36,
    },
    webPreferences: {
      preload: app.isPackaged
        ? path.join(__dirname, 'preload.js')
        : path.join(__dirname, '../../.erb/dll/preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
    },
  });

  mainWindow = win;
  win.loadURL(resolveHtmlPath('index.html'));

  win.on('ready-to-show', () => {
    if (process.env.START_MINIMIZED) {
      win.minimize();
    } else {
      win.show();
    }
  });

  win.on('closed', () => {
    if (mainWindow === win) mainWindow = null;
  });

  trackWindowState(win);
  flushPreferencesOnClose(win);
  if (isDevelopment()) addInspectElementMenu(win);

  return win;
}

export function getMainWindow(): BrowserWindow | null {
  return mainWindow;
}

/** Brings the editor to the front, creating it if it was closed. */
export function showMainWindow(): void {
  const win = mainWindow ?? createMainWindow();
  // A new window shows itself once its page is ready.
  if (win.webContents.isLoading()) return;
  if (win.isMinimized()) win.restore();
  win.show();
  win.focus();
}

export const ensureMainWindowReady = async (): Promise<BrowserWindow> => {
  if (mainWindow === null) {
    createMainWindow();
  }
  if (!mainWindow) throw new Error('Failed to create main window');
  const win = mainWindow;
  if (win.webContents.isLoading()) {
    await new Promise<void>((resolve) => {
      win.webContents.once('did-finish-load', () => resolve());
    });
  }
  if (win.isMinimized()) win.restore();
  win.show();
  win.focus();
  return win;
};

/** Hides a window and resolves once the compositor has dropped it. */
const hideAndWait = (win: BrowserWindow): Promise<void> =>
  new Promise<void>((resolve) => {
    const timeout = setTimeout(resolve, 300 /* ms safety timeout */);
    win.once('hide', () => {
      clearTimeout(timeout);
      setTimeout(resolve, COMPOSITOR_FRAME_MS);
    });
    try {
      win.hide();
    } catch {
      clearTimeout(timeout);
      resolve();
    }
  });

const isShown = (win: BrowserWindow | null): win is BrowserWindow =>
  !!win && !win.isDestroyed() && win.isVisible();

/**
 * Hides every X-Shot window that could appear in a capture: the editor and,
 * if open, Preferences. Resolves once neither can be in the pixels.
 */
export const hideWindowsForCapture = async (): Promise<void> => {
  const hiding: Promise<void>[] = [];
  if (isShown(mainWindow)) hiding.push(hideAndWait(mainWindow));
  if (isShown(preferencesWindow)) {
    preferencesHiddenForCapture = true;
    hiding.push(hideAndWait(preferencesWindow));
  }
  await Promise.all(hiding);
};

/** Shows the Preferences window again if a capture hid it. */
export const restoreWindowsAfterCapture = (): void => {
  if (!preferencesHiddenForCapture) return;
  preferencesHiddenForCapture = false;
  if (preferencesWindow && !preferencesWindow.isDestroyed()) {
    preferencesWindow.showInactive();
  }
};

export const enableScreenSaverMode = (): void => {
  if (!mainWindow) return;
  mainWindow.setAlwaysOnTop(true, 'floating');
  mainWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
};

export const disableScreenSaverMode = (): void => {
  if (!mainWindow) return;
  mainWindow.setAlwaysOnTop(false);
  mainWindow.setVisibleOnAllWorkspaces(false);
};

export const closeScreenshotOverlays = async (): Promise<void> => {
  const logger = getLogger('windows');
  if (screenshotWindows.length === 0) {
    disableScreenSaverMode();
    return;
  }

  const windowsToClose = [...screenshotWindows];
  screenshotWindows = [];

  const gracefulClose = (w: BrowserWindow): Promise<void> =>
    new Promise((resolve) => {
      const finish = () => {
        try {
          try {
            w.setVisibleOnAllWorkspaces(false);
          } catch {
            // noop
          }
          try {
            w.setAlwaysOnTop(false);
          } catch {
            // noop
          }
          if (w.isDestroyed()) {
            resolve();
            return;
          }
          const timeout = setTimeout(resolve, WINDOW_EVENT_TIMEOUT_MS);
          w.once('closed', () => {
            clearTimeout(timeout);
            resolve();
          });
          w.close();
        } catch (error) {
          logger.warn('Failed to close screenshot window', error);
          resolve();
        }
      };

      // If we're in simple fullscreen on macOS, exit cleanly first
      if (process.platform === 'darwin' && w.isSimpleFullScreen?.()) {
        const timeout = setTimeout(finish, 500 /* ms safety timeout */);
        w.once('leave-full-screen', () => {
          clearTimeout(timeout);
          finish();
        });
        try {
          w.setSimpleFullScreen(false);
        } catch {
          finish();
        }
      } else {
        finish();
      }
    });

  try {
    // Every overlay must be gone, not just asked to close, before anything
    // reads screen pixels.
    await Promise.all(windowsToClose.map((w) => gracefulClose(w)));
    await nextFrame();
  } catch (err) {
    logger.warn('Error while closing screenshot overlays', err);
  } finally {
    disableScreenSaverMode();
  }
};

export const createScreenshotOverlays = async (): Promise<void> => {
  const logger = getLogger('windows');
  const displays = screen.getAllDisplays();
  const baseUrl = resolveHtmlPath('index.html');
  const cursorPoint = screen.getCursorScreenPoint();
  const focusedDisplay = screen.getDisplayNearestPoint(cursorPoint);

  // Close existing overlays first
  if (screenshotWindows.length > 0) {
    screenshotWindows.forEach((w) => {
      try {
        w.close();
      } catch (error) {
        logger.warn('Failed to close screenshot window', error);
      }
    });
    screenshotWindows = [];
  }

  enableScreenSaverMode();

  const primaryDisplayId = screen.getPrimaryDisplay().id;
  displays.forEach((display) => {
    const { x, y, width, height } = display.bounds;
    const overlay = new BrowserWindow({
      x,
      y,
      width,
      height,
      transparent: true,
      frame: false,
      alwaysOnTop: true,
      skipTaskbar: true,
      resizable: false,
      movable: false,
      show: false,
      titleBarStyle: 'hidden',
      fullscreenable: true,
      webPreferences: {
        preload: app.isPackaged
          ? path.join(__dirname, 'preload.js')
          : path.join(__dirname, '../../.erb/dll/preload.js'),
        nodeIntegration: false,
        contextIsolation: true,
        sandbox: true,
        backgroundThrottling: false,
      },
    });

    const isPrimary = display.id === primaryDisplayId;
    const url = `${baseUrl}#/screenshot?offsetX=${x}&offsetY=${y}&displayId=${display.id}&primary=${
      isPrimary ? '1' : '0'
    }`;
    overlay.loadURL(url);

    // Ensure overlay appears across all spaces and full-screen apps (macOS)
    overlay.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });

    overlay.once('ready-to-show', () => {
      logger.info(`✅ Screenshot overlay ready on display ${display.id}`);
      overlay.setAlwaysOnTop(true, 'floating');
      // Enter full screen on the focused display only so we own input over the menu bar
      try {
        if (display.id === focusedDisplay.id) {
          if (process.platform === 'darwin') overlay.setSimpleFullScreen(true);
          else overlay.setFullScreen(true);
        }
      } catch (error) {
        logger.warn('Failed to set fullscreen on screenshot overlay', error);
      }
      markCaptureStage('overlay-visible', {
        displayId: display.id,
        focused: display.id === focusedDisplay.id,
      });
      if (display.id === focusedDisplay.id) {
        overlay.show();
        overlay.focus();
      } else {
        overlay.showInactive();
      }
    });

    overlay.on('closed', () => {
      screenshotWindows = screenshotWindows.filter((w) => w !== overlay);
    });

    screenshotWindows.push(overlay);
  });
};

export const showScreenshotOverlays = (): void => {
  const logger = getLogger('windows');
  if (screenshotWindows.length === 0) return;
  enableScreenSaverMode();
  screenshotWindows.forEach((w) => {
    try {
      w.setAlwaysOnTop(true, 'floating');
      w.showInactive();
    } catch (error) {
      logger.warn('Failed to show screenshot overlay window', error);
    }
  });
};

export const areOverlaysOpen = (): boolean => screenshotWindows.length > 0;

export async function createPreferencesWindow(): Promise<BrowserWindow> {
  if (preferencesWindow && !preferencesWindow.isDestroyed()) {
    preferencesWindow.show();
    preferencesWindow.focus();
    return preferencesWindow;
  }

  const RESOURCES_PATH = getResourcesPath();
  const getAssetPath = (...paths: string[]): string =>
    path.join(RESOURCES_PATH, ...paths);

  preferencesWindow = new BrowserWindow({
    title: 'X-Shot Preferences',
    width: 600,
    height: 700,
    minWidth: 500,
    minHeight: 600,
    show: false,
    resizable: true,
    icon: getAssetPath('icon.png'),
    titleBarStyle: 'hidden',
    titleBarOverlay: {
      color: '#111111',
      symbolColor: '#ffffff',
      height: 36,
    },
    webPreferences: {
      preload: app.isPackaged
        ? path.join(__dirname, 'preload.js')
        : path.join(__dirname, '../../.erb/dll/preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
    },
  });

  // Load the preferences route
  const baseUrl = resolveHtmlPath('index.html');
  const url = `${baseUrl}#/preferences`;
  preferencesWindow.loadURL(url);

  preferencesWindow.on('ready-to-show', () => {
    if (!preferencesWindow) return;
    preferencesWindow.show();
    preferencesWindow.focus();
  });

  preferencesWindow.on('closed', () => {
    preferencesWindow = null;
  });

  trackWindowState(preferencesWindow);
  flushPreferencesOnClose(preferencesWindow);

  return preferencesWindow;
}

export function getPreferencesWindow(): BrowserWindow | null {
  return preferencesWindow;
}
