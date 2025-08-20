import path from 'path';
import { app, BrowserWindow, Menu, Tray } from 'electron';
import { DEFAULT_SCREENSHOT_ACCELERATOR } from './hotkeys';
import getResourcesPath from '../shared/utils';
import { createPreferencesWindow } from './windows';
import { getLogger } from './logger';

let tray: Tray | null = null;

export default function createTray(
  mainWindowGetter: () => BrowserWindow | null,
  onScreenshot: () => void,
) {
  const logger = getLogger('tray');
  const RESOURCES_PATH = getResourcesPath();
  const getAssetPath = (...paths: string[]): string =>
    path.join(RESOURCES_PATH, ...paths);

  const iconPath = getAssetPath('icons', '16x16.png');
  tray = new Tray(iconPath);

  const contextMenu = Menu.buildFromTemplate([
    {
      label: 'Show App',
      click: () => {
        const win = mainWindowGetter();
        if (win) {
          win.show();
          win.focus();
        }
      },
    },
    {
      label: 'Take Screenshot',
      accelerator: DEFAULT_SCREENSHOT_ACCELERATOR,
      click: () => {
        onScreenshot();
      },
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

  tray.setContextMenu(contextMenu);
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

export { createTray };
