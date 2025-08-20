import { app, globalShortcut } from 'electron';
import { getLogger } from './logger';

export const DEFAULT_SCREENSHOT_ACCELERATOR =
  process.env.XSHOT_HOTKEY || 'CommandOrControl+Shift+1';

export function registerScreenshotHotkey(
  accelerator: string,
  onTrigger: () => void,
): boolean {
  const logger = getLogger('hotkeys');
  if (!app.isReady()) {
    throw new Error(
      'registerScreenshotHotkey must be called after app.whenReady',
    );
  }

  try {
    if (globalShortcut.isRegistered(accelerator)) {
      globalShortcut.unregister(accelerator);
    }
    const ok = globalShortcut.register(accelerator, onTrigger);
    if (!ok) {
      logger.warn(`Failed to register global shortcut: ${accelerator}`);
    }
    return ok;
  } catch (err) {
    logger.error('Error registering global shortcut', err);
    return false;
  }
}

export function unregisterAllHotkeys(): void {
  const logger = getLogger('hotkeys');
  try {
    globalShortcut.unregisterAll();
  } catch (err) {
    logger.error('Error unregistering global shortcuts', err);
  }
}
