/* eslint global-require: off, no-console: off */
import path from 'path';
import { app, BrowserWindow, shell, screen } from 'electron';
import { autoUpdater } from 'electron-updater';
import log from 'electron-log';
import MenuBuilder from './menu';
import { resolveHtmlPath } from './util';

class AppUpdater {
  constructor() {
    log.transports.file.level = 'info';
    autoUpdater.logger = log;
    autoUpdater.checkForUpdatesAndNotify();
  }
}

let mainWindow: BrowserWindow | null = null;
let screenshotWindows: BrowserWindow[] = [];

function getResourcesPath(): string {
  return app.isPackaged
    ? path.join(process.resourcesPath, 'assets')
    : path.join(__dirname, '../../assets');
}

export function createMainWindow(): BrowserWindow {
  const RESOURCES_PATH = getResourcesPath();
  const getAssetPath = (...paths: string[]): string =>
    path.join(RESOURCES_PATH, ...paths);

  mainWindow = new BrowserWindow({
    show: false,
    width: 1425,
    height: 930,
    icon: getAssetPath('icon.png'),
    titleBarStyle: process.platform === 'darwin' ? 'hiddenInset' : undefined,
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
  if (screenshotWindows.length > 0) {
    screenshotWindows.forEach((w) => {
      try {
        w.close();
      } catch {
        // ignore
      }
    });
    screenshotWindows = [];
  }
  disableScreenSaverMode();
};

export const createScreenshotOverlays = async (): Promise<void> => {
  const displays = screen.getAllDisplays();
  const baseUrl = resolveHtmlPath('index.html');
  const cursorPoint = screen.getCursorScreenPoint();
  const focusedDisplay = screen.getDisplayNearestPoint(cursorPoint);

  // Close existing overlays first (without disabling mode)
  if (screenshotWindows.length > 0) {
    screenshotWindows.forEach((w) => {
      try {
        w.close();
      } catch {
        // ignore
      }
    });
    screenshotWindows = [];
  }

  // Enable screen-saver mode for main window
  enableScreenSaverMode();

  // Resolve asset path if needed in future
  // const RESOURCES_PATH = getResourcesPath();

  // Create one overlay window per display
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
      console.log('✅ Screenshot overlay ready on display', display.id);
      overlay.setAlwaysOnTop(true, 'floating');
      // Enter full screen so the overlay covers menu bar/taskbar
      try {
        if (process.platform === 'darwin') overlay.setSimpleFullScreen(true);
        else overlay.setFullScreen(true);
      } catch {
        // ignore
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
  if (screenshotWindows.length === 0) return;
  enableScreenSaverMode();
  screenshotWindows.forEach((w) => {
    try {
      w.setAlwaysOnTop(true, 'floating');
      w.showInactive();
    } catch {
      // ignore
    }
  });
};

export const areOverlaysOpen = (): boolean => screenshotWindows.length > 0;
