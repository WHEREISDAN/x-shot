import { app, globalShortcut } from 'electron';
import { getLogger } from './logger';

export const DEFAULT_SCREENSHOT_ACCELERATOR =
  process.env.XSHOT_HOTKEY || 'CommandOrControl+Shift+1';

type HotkeyLabel = 'main' | '3s delayed' | '5s delayed' | 'recapture';

/** A shortcut that could not be registered, so its slot kept the old one. */
export interface HotkeyFailure {
  label: HotkeyLabel;
  accelerator: string;
}

let currentMainHotkey: string | null = null;
let currentDelay3Hotkey: string | null = null;
let currentDelay5Hotkey: string | null = null;
let currentRecaptureHotkey: string | null = null;

/**
 * Electron throws a TypeError for accelerators it cannot parse, so every
 * registration is guarded; a bad value must never abort app startup.
 */
function registerSafely(
  accelerator: string,
  callback: () => void,
  label: HotkeyLabel,
): boolean {
  const logger = getLogger('hotkeys');
  try {
    if (globalShortcut.isRegistered(accelerator)) {
      logger.warn(
        `Skipping ${label} shortcut: ${accelerator} is already bound to another X-Shot shortcut`,
      );
      return false;
    }
    const ok = globalShortcut.register(accelerator, callback);
    if (!ok) {
      logger.warn(`Failed to register ${label} shortcut: ${accelerator}`);
    }
    return ok;
  } catch (err) {
    logger.error(`Invalid ${label} shortcut: ${accelerator}`, err);
    return false;
  }
}

function unregisterSafely(accelerator: string | null): void {
  if (!accelerator) return;
  try {
    if (globalShortcut.isRegistered(accelerator)) {
      globalShortcut.unregister(accelerator);
    }
  } catch (err) {
    getLogger('hotkeys').error(
      `Failed to unregister shortcut: ${accelerator}`,
      err,
    );
  }
}

/**
 * Rebinds one slot. If the new accelerator cannot be registered, the slot
 * keeps its previous one and the failure is reported.
 */
function rebind(
  current: string | null,
  next: string | null | undefined,
  callback: () => void,
  label: HotkeyLabel,
  failures: HotkeyFailure[],
): string | null {
  unregisterSafely(current);
  const accelerator = next || null;
  if (!accelerator) return null;
  if (registerSafely(accelerator, callback, label)) return accelerator;
  failures.push({ label, accelerator });
  if (current && current !== accelerator) {
    return registerSafely(current, callback, label) ? current : null;
  }
  return null;
}

export function unregisterAllHotkeys(): void {
  const logger = getLogger('hotkeys');
  try {
    globalShortcut.unregisterAll();
  } catch (err) {
    logger.error('Error unregistering global shortcuts', err);
  }
}

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
): HotkeyFailure[] {
  const logger = getLogger('hotkeys');
  const failures: HotkeyFailure[] = [];
  if (!app.isReady()) {
    logger.warn('updateRegisteredHotkeys called before app ready');
    return failures;
  }

  if (hotkeys.main !== undefined) {
    currentMainHotkey = rebind(
      currentMainHotkey,
      hotkeys.main,
      triggers.triggerMain,
      'main',
      failures,
    );
  }

  if (hotkeys.delay3 !== undefined) {
    const delayMs = hotkeys.delay3?.delayMs ?? 3000;
    currentDelay3Hotkey = rebind(
      currentDelay3Hotkey,
      hotkeys.delay3?.accelerator,
      () => triggers.triggerDelay(delayMs),
      '3s delayed',
      failures,
    );
  }

  if (hotkeys.delay5 !== undefined) {
    const delayMs = hotkeys.delay5?.delayMs ?? 5000;
    currentDelay5Hotkey = rebind(
      currentDelay5Hotkey,
      hotkeys.delay5?.accelerator,
      () => triggers.triggerDelay(delayMs),
      '5s delayed',
      failures,
    );
  }

  if (hotkeys.recapture !== undefined) {
    currentRecaptureHotkey = rebind(
      currentRecaptureHotkey,
      hotkeys.recapture,
      triggers.triggerRecapture,
      'recapture',
      failures,
    );
  }
  return failures;
}
