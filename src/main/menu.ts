import { app, Menu } from 'electron';
import { DEFAULT_SCREENSHOT_ACCELERATOR } from './hotkeys';
import { loadPreferences } from './preferences';
import { getLogger } from './logger';
import { recaptureLastSelection } from './capture-actions';
import { scheduleCapture, startCapture } from './capture-coordinator';
import { createPreferencesWindow, showMainWindow } from './windows';
import { openExternalIfAllowed } from './navigation-guards';
import {
  acceleratorsFrom,
  applicationMenuTemplate,
  type CaptureAccelerators,
  type MenuActions,
} from './menu-template';

const PROJECT_URL = 'https://github.com/WHEREISDAN/x-shot';

const logger = getLogger('menu');

function runDetached(work: Promise<unknown>): void {
  work.catch((err) => logger.error('Menu action failed', err));
}

/** What menu items do; `trigger` tells capture diagnostics where from. */
export function menuActions(trigger: 'menu' | 'tray'): MenuActions {
  return {
    showApp: showMainWindow,
    takeScreenshot: () => runDetached(startCapture(trigger)),
    recapture: () => runDetached(recaptureLastSelection()),
    delayedScreenshot: (delayMs) => scheduleCapture(delayMs, 'delayed'),
    openPreferences: () => runDetached(createPreferencesWindow()),
    quit: () => app.quit(),
    openProjectPage: () => {
      openExternalIfAllowed(PROJECT_URL);
    },
  };
}

/** The capture shortcuts currently saved in preferences. */
export async function savedAccelerators(): Promise<CaptureAccelerators> {
  const prefs = await loadPreferences();
  return acceleratorsFrom(prefs.capture, DEFAULT_SCREENSHOT_ACCELERATOR);
}

/** Builds the application menu with the saved shortcuts. */
export async function refreshApplicationMenu(): Promise<void> {
  const template = applicationMenuTemplate({
    platform: process.platform,
    isDevelopment:
      process.env.NODE_ENV === 'development' ||
      process.env.DEBUG_PROD === 'true',
    accelerators: await savedAccelerators(),
    actions: menuActions('menu'),
  });
  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}
