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

let currentMainHotkey: string | null = null;
let currentDelay3Hotkey: string | null = null;
let currentDelay5Hotkey: string | null = null;
let currentRecaptureHotkey: string | null = null;

export function updateRegisteredHotkeys(
  hotkeys: {
    main?: string | null;
    delay3?: { accelerator: string | null; delayMs: number } | null;
    delay5?: { accelerator: string | null; delayMs: number } | null;
    recapture?: string | null;
  },
  triggers: {
    triggerMain: () => void;
    triggerDelay: (delayMs: number) => void;
    triggerRecapture: () => void;
  },
): void {
  const logger = getLogger('hotkeys');
  if (!app.isReady()) {
    logger.warn('updateRegisteredHotkeys called before app ready');
    return;
  }

  // Main
  if (hotkeys.main !== undefined) {
    if (currentMainHotkey && globalShortcut.isRegistered(currentMainHotkey)) {
      globalShortcut.unregister(currentMainHotkey);
    }
    currentMainHotkey = hotkeys.main || null;
    if (currentMainHotkey) {
      const ok = globalShortcut.register(currentMainHotkey, triggers.triggerMain);
      if (!ok)
        logger.warn(`Failed to register main shortcut: ${currentMainHotkey}`);
    }
  }

  // Delay 3
  if (hotkeys.delay3 !== undefined) {
    if (currentDelay3Hotkey && globalShortcut.isRegistered(currentDelay3Hotkey)) {
      globalShortcut.unregister(currentDelay3Hotkey);
    }
    currentDelay3Hotkey = hotkeys.delay3?.accelerator || null;
    if (currentDelay3Hotkey) {
      const d = hotkeys.delay3?.delayMs ?? 3000;
      const ok = globalShortcut.register(currentDelay3Hotkey, () =>
        triggers.triggerDelay(d),
      );
      if (!ok)
        logger.warn(
          `Failed to register 3s delayed shortcut: ${currentDelay3Hotkey}`,
        );
    }
  }

  // Delay 5
  if (hotkeys.delay5 !== undefined) {
    if (currentDelay5Hotkey && globalShortcut.isRegistered(currentDelay5Hotkey)) {
      globalShortcut.unregister(currentDelay5Hotkey);
    }
    currentDelay5Hotkey = hotkeys.delay5?.accelerator || null;
    if (currentDelay5Hotkey) {
      const d = hotkeys.delay5?.delayMs ?? 5000;
      const ok = globalShortcut.register(currentDelay5Hotkey, () =>
        triggers.triggerDelay(d),
      );
      if (!ok)
        logger.warn(
          `Failed to register 5s delayed shortcut: ${currentDelay5Hotkey}`,
        );
    }
  }

  // Recapture last area
  if (hotkeys.recapture !== undefined) {
    if (
      currentRecaptureHotkey &&
      globalShortcut.isRegistered(currentRecaptureHotkey)
    ) {
      globalShortcut.unregister(currentRecaptureHotkey);
    }
    currentRecaptureHotkey = hotkeys.recapture || null;
    if (currentRecaptureHotkey) {
      const ok = globalShortcut.register(
        currentRecaptureHotkey,
        triggers.triggerRecapture,
      );
      if (!ok)
        logger.warn(
          `Failed to register recapture shortcut: ${currentRecaptureHotkey}`,
        );
    }
  }
}
