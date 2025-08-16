import path from 'path';
import { app, BrowserWindow, Menu, Tray } from 'electron';
import { DEFAULT_SCREENSHOT_ACCELERATOR } from './hotkeys';

let tray: Tray | null = null;

function getResourcesPath(): string {
  return app.isPackaged
    ? path.join(process.resourcesPath, 'assets')
    : path.join(__dirname, '../../assets');
}

export default function createTray(
  mainWindowGetter: () => BrowserWindow | null,
  onScreenshot: () => void,
) {
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

export { createTray };
