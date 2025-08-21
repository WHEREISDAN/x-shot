/* eslint global-require: off, no-console: off */
import path from 'path';
import { app, BrowserWindow, shell, screen } from 'electron';
import { autoUpdater } from 'electron-updater';
import log from 'electron-log';
import { getLogger } from './logger';
import MenuBuilder from './menu';
import { resolveHtmlPath } from './util';
import getResourcesPath from '../shared/utils';

class AppUpdater {
  constructor() {
    log.transports.file.level = 'info';
    autoUpdater.logger = log;
    autoUpdater.checkForUpdatesAndNotify();
  }
}

let mainWindow: BrowserWindow | null = null;
let preferencesWindow: BrowserWindow | null = null;
let screenshotWindows: BrowserWindow[] = [];

export function createMainWindow(): BrowserWindow {
  const RESOURCES_PATH = getResourcesPath();
  const getAssetPath = (...paths: string[]): string =>
    path.join(RESOURCES_PATH, ...paths);

  mainWindow = new BrowserWindow({
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
    },
  });

  mainWindow.loadURL(resolveHtmlPath('index.html'));

  mainWindow.on('ready-to-show', () => {
    if (!mainWindow) throw new Error('"mainWindow" is not defined');
    if (process.env.START_MINIMIZED) {
      mainWindow.minimize();
    } else {
      mainWindow.show();
    }
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  const menuBuilder = new MenuBuilder(mainWindow);
  menuBuilder.buildMenu();

  mainWindow.webContents.setWindowOpenHandler((edata) => {
    shell.openExternal(edata.url);
    return { action: 'deny' } as const;
  });

  // eslint-disable-next-line no-new
  new AppUpdater();

  return mainWindow;
}

export function getMainWindow(): BrowserWindow | null {
  return mainWindow;
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

export const closeScreenshotOverlays = (): void => {
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
          w.close();
        } catch (error) {
          logger.warn('Failed to close screenshot window', error);
        }
        resolve();
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

  Promise.all(windowsToClose.map((w) => gracefulClose(w)))
    .then(() => disableScreenSaverMode())
    .catch((err) => {
      logger.warn('Error while closing screenshot overlays', err);
      disableScreenSaverMode();
    });
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

  // Prevent external links from opening in preferences window
  preferencesWindow.webContents.setWindowOpenHandler((edata) => {
    shell.openExternal(edata.url);
    return { action: 'deny' } as const;
  });

  return preferencesWindow;
}

export function getPreferencesWindow(): BrowserWindow | null {
  return preferencesWindow;
}
