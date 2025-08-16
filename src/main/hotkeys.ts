import { app, globalShortcut } from 'electron';

export const DEFAULT_SCREENSHOT_ACCELERATOR =
  process.env.XSHOT_HOTKEY || 'CommandOrControl+Shift+1';

export function registerScreenshotHotkey(
  accelerator: string,
  onTrigger: () => void,
): boolean {
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
      console.warn(`Failed to register global shortcut: ${accelerator}`);
    }
    return ok;
  } catch (err) {
    console.error('Error registering global shortcut', err);
    return false;
  }
}

export function unregisterAllHotkeys(): void {
  try {
    globalShortcut.unregisterAll();
  } catch (err) {
    console.error('Error unregistering global shortcuts', err);
  }
}
