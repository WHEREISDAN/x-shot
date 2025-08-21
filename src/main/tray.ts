import path from 'path';
import { app, BrowserWindow, Menu, Tray, ipcMain } from 'electron';
import { DEFAULT_SCREENSHOT_ACCELERATOR } from './hotkeys';
import getResourcesPath from '../shared/utils';
import { createPreferencesWindow, ensureMainWindowReady } from './windows';
import { loadPreferences } from './preferences';
import { getLogger } from './logger';

let tray: Tray | null = null;

async function buildContextMenu(
  mainWindowGetter: () => BrowserWindow | null,
  onScreenshot: () => void,
) {
  const logger = getLogger('tray');
  const prefs = await loadPreferences();
  const accMain = prefs.capture.hotkey || DEFAULT_SCREENSHOT_ACCELERATOR;
  const acc3 = prefs.capture.hotkeyDelay3 || undefined;
  const acc5 = prefs.capture.hotkeyDelay5 || undefined;
  const accRecapture = prefs.capture.hotkeyRecapture || undefined;

  return Menu.buildFromTemplate([
    {
      label: 'Show App',
      click: () => {
        ensureMainWindowReady().catch(() => {
          const win = mainWindowGetter();
          if (win) {
            win.show();
            win.focus();
          }
        });
      },
    },
    {
      label: 'Take Screenshot',
      accelerator: accMain,
      click: () => {
        onScreenshot();
      },
    },
    {
      label: 'Re-capture Last Area',
      ...(accRecapture ? { accelerator: accRecapture } : {}),
      click: async () => {
        try {
          const latest = await loadPreferences();
          const last = latest.capture.lastSelection;
          if (last) {
            // Trigger existing capture path using selection handler
            ipcMain.emit('screenshot-data', undefined, {
              x: last.x,
              y: last.y,
              width: last.width,
              height: last.height,
            });
          }
        } catch (err) {
          logger.error('Failed to re-capture last area', err);
        }
      },
    },
    {
      label: 'Delayed Screenshot (3s)',
      ...(acc3 ? { accelerator: acc3 } : {}),
      click: () => setTimeout(() => onScreenshot(), 3000),
    },
    {
      label: 'Delayed Screenshot (5s)',
      ...(acc5 ? { accelerator: acc5 } : {}),
      click: () => setTimeout(() => onScreenshot(), 5000),
    },
    { type: 'separator' },
    {
      label: 'Preferences...',
      click: async () => {
        try {
          await createPreferencesWindow();
        } catch (error) {
          logger.error('Failed to open preferences window', error);
        }
      },
    },
    { type: 'separator' },
    {
      label: 'Quit',
      click: () => {
        app.quit();
      },
    },
  ]);
}

export default function createTray(
  mainWindowGetter: () => BrowserWindow | null,
  onScreenshot: () => void,
) {
  // Use local logger in this scope only where needed
  const RESOURCES_PATH = getResourcesPath();
  const getAssetPath = (...paths: string[]): string =>
    path.join(RESOURCES_PATH, ...paths);

  const iconPath = getAssetPath('icons', '16x16.png');
  tray = new Tray(iconPath);

  buildContextMenu(mainWindowGetter, onScreenshot)
    .then((contextMenu) => tray?.setContextMenu(contextMenu))
    .catch((e) => getLogger('tray').warn('Failed to build tray menu', e));
  tray.setToolTip('Screenshot Tool');
  tray.on('click', () => tray?.popUpContextMenu());

  return tray;
}

/**
 * Show the system tray icon
 */
export function showTray() {
  // Tray is already created, just make sure it's visible
  // Note: Electron doesn't have a direct way to hide/show tray icons
  // The tray is automatically visible when created
}

/**
 * Hide the system tray icon
 */
export function hideTray() {
  if (tray) {
    tray.destroy();
    tray = null;
  }
}

/**
 * Check if the tray is currently visible
 */
export function isTrayVisible(): boolean {
  return tray !== null;
}

/**
 * Update tray visibility based on preference
 */
export function updateTrayVisibility(
  show: boolean,
  mainWindowGetter: () => BrowserWindow | null,
  onScreenshot: () => void,
) {
  if (show && !tray) {
    // Create tray if it doesn't exist and should be shown
    createTray(mainWindowGetter, onScreenshot);
  } else if (!show && tray) {
    // Hide tray if it exists and should be hidden
    hideTray();
  }
}

export async function refreshTrayMenu(
  mainWindowGetter: () => BrowserWindow | null,
  onScreenshot: () => void,
): Promise<void> {
  if (!tray) return;
  try {
    const menu = await buildContextMenu(mainWindowGetter, onScreenshot);
    tray.setContextMenu(menu);
  } catch (e) {
    getLogger('tray').warn('Failed to refresh tray menu', e);
  }
}

export { createTray };
