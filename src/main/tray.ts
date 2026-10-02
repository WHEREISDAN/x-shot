import path from 'path';
import { Menu, Tray } from 'electron';
import getResourcesPath from '../shared/utils';
import { getLogger } from './logger';
import { menuActions, savedAccelerators } from './menu';
import { captureMenuItems } from './menu-template';

const logger = getLogger('tray');

let tray: Tray | null = null;

async function buildTrayMenu(): Promise<Menu> {
  return Menu.buildFromTemplate(
    captureMenuItems(await savedAccelerators(), menuActions('tray')),
  );
}

/** Rebuilds the tray menu, e.g. after the saved shortcuts changed. */
export async function refreshTrayMenu(): Promise<void> {
  if (!tray) return;
  try {
    const menu = await buildTrayMenu();
    tray?.setContextMenu(menu);
  } catch (error) {
    logger.warn('Failed to build tray menu', error);
  }
}

export function createTray(): Tray {
  const iconPath = path.join(getResourcesPath(), 'icons', '16x16.png');
  const created = new Tray(iconPath);
  tray = created;
  created.setToolTip('X-Shot');
  created.on('click', () => created.popUpContextMenu());
  refreshTrayMenu().catch(() => undefined);
  return created;
}

export function hideTray(): void {
  tray?.destroy();
  tray = null;
}

export function isTrayVisible(): boolean {
  return tray !== null;
}

/** Shows or hides the tray icon to match the preference. */
export function updateTrayVisibility(show: boolean): void {
  if (show && !tray) createTray();
  else if (!show && tray) hideTray();
}
