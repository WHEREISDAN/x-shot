import { app, BrowserWindow, ipcMain } from 'electron';
import log from 'electron-log';
import type {
  AppPreferences,
  ImportBackgroundResponse,
  PreferencesUpdate,
  SetPreferencesResponse,
} from '../../shared/ipc-types';
import type { HotkeyFailure } from '../hotkeys';
import {
  loadPreferences,
  resetPreferences,
  saveBackgroundImage,
  updatePreferences,
} from '../preferences';
import { isPlainObject, isPreferencesUpdate } from '../preferences-schema';
import { createPreferencesWindow } from '../windows';

/** Shortcut slots an update changes; undefined slots stay as they are. */
export interface HotkeyChanges {
  main?: string | null;
  delay3?: string | null;
  delay5?: string | null;
  recapture?: string | null;
}

export interface HotkeysHandler {
  /** Registers the changed shortcuts; returns the ones that were taken. */
  apply: (changes: HotkeyChanges) => HotkeyFailure[];
  /** Runs once changed shortcuts are saved, e.g. to refresh menus. */
  saved: () => void;
}

let hotkeysHandler: HotkeysHandler | null = null;
let onTrayVisibilityChange: ((show: boolean) => void) | null = null;

export function setHotkeysHandler(handler: HotkeysHandler) {
  hotkeysHandler = handler;
}

export function setTrayVisibilityChangeCallback(
  callback: (show: boolean) => void,
) {
  onTrayVisibilityChange = callback;
}

const messageOf = (error: unknown) =>
  error instanceof Error ? error.message : String(error);

/** The shortcuts an update really changes, compared with the current ones. */
function hotkeyChanges(
  updates: PreferencesUpdate,
  current: AppPreferences,
): HotkeyChanges {
  const capture = updates.capture ?? {};
  const changed = <K extends keyof AppPreferences['capture']>(key: K) =>
    capture[key] !== undefined && capture[key] !== current.capture[key];
  return {
    ...(changed('hotkey') && capture.hotkey ? { main: capture.hotkey } : {}),
    ...(changed('hotkeyDelay3') ? { delay3: capture.hotkeyDelay3 } : {}),
    ...(changed('hotkeyDelay5') ? { delay5: capture.hotkeyDelay5 } : {}),
    ...(changed('hotkeyRecapture')
      ? { recapture: capture.hotkeyRecapture }
      : {}),
  };
}

/** The same slots as `changes`, set back to their current values. */
function previousHotkeys(
  changes: HotkeyChanges,
  current: AppPreferences,
): HotkeyChanges {
  const { capture } = current;
  return {
    ...('main' in changes ? { main: capture.hotkey } : {}),
    ...('delay3' in changes ? { delay3: capture.hotkeyDelay3 ?? null } : {}),
    ...('delay5' in changes ? { delay5: capture.hotkeyDelay5 ?? null } : {}),
    ...('recapture' in changes
      ? { recapture: capture.hotkeyRecapture ?? null }
      : {}),
  };
}

function conflictMessage(failures: HotkeyFailure[]): string {
  const keys = failures.map((failure) => failure.accelerator).join(', ');
  return `The shortcut ${keys} is already in use by another app or X-Shot shortcut. Your previous shortcut still works.`;
}

/** Electron only supports login item registration on macOS and Windows. */
export function supportsLaunchAtStartup(
  platform: typeof process.platform = process.platform,
): boolean {
  return platform === 'darwin' || platform === 'win32';
}

function applyLaunchAtStartup(enabled: boolean): void {
  if (!supportsLaunchAtStartup()) return;
  app.setLoginItemSettings({
    openAtLogin: enabled,
    name: 'X-Shot',
  });
}

function broadcastPreferencesChanged(preferences: AppPreferences): void {
  BrowserWindow.getAllWindows().forEach((win) => {
    if (!win.isDestroyed()) {
      win.webContents.send('preferences-changed', preferences);
    }
  });
}

function applyPostSaveSideEffects(
  preferences: AppPreferences,
  options: {
    refreshHotkeys: boolean;
    applyLoginItem: boolean;
    applyTray: boolean;
  },
): void {
  if (options.refreshHotkeys) hotkeysHandler?.saved();
  if (options.applyLoginItem) {
    applyLaunchAtStartup(preferences.system.launchAtStartup);
  }
  if (options.applyTray) {
    onTrayVisibilityChange?.(preferences.system.showInTray);
  }
  broadcastPreferencesChanged(preferences);
}

/**
 * Applies a preferences update. Shortcuts are registered first, so one that
 * is taken is reported and nothing is saved; the update is saved before any
 * other system setting changes.
 */
export async function applyPreferencesUpdate(
  request: unknown,
): Promise<SetPreferencesResponse> {
  const updates = isPlainObject(request) ? request.preferences : undefined;
  if (!isPreferencesUpdate(updates)) {
    return { ok: false, error: 'Invalid preferences request.' };
  }
  const update = updates as PreferencesUpdate;
  const current = await loadPreferences();
  const changes = hotkeyChanges(update, current);
  const hasHotkeyChanges = Object.keys(changes).length > 0;

  if (hasHotkeyChanges && hotkeysHandler) {
    const failures = hotkeysHandler.apply(changes);
    if (failures.length > 0) {
      return { ok: false, error: conflictMessage(failures) };
    }
  }

  let preferences: AppPreferences;
  try {
    preferences = await updatePreferences(update);
  } catch (error) {
    log.error('Failed to save preferences:', error);
    if (hasHotkeyChanges) {
      hotkeysHandler?.apply(previousHotkeys(changes, current));
    }
    return {
      ok: false,
      error: `Your preferences could not be saved: ${messageOf(error)}`,
    };
  }

  applyPostSaveSideEffects(preferences, {
    refreshHotkeys: hasHotkeyChanges,
    applyLoginItem: update.system?.launchAtStartup !== undefined,
    applyTray: update.system?.showInTray !== undefined,
  });
  return { ok: true, preferences };
}

/** Resets stored preferences to defaults and reconciles all OS side effects. */
export async function applyPreferencesReset(): Promise<AppPreferences> {
  const defaultPrefs = await resetPreferences();
  if (hotkeysHandler) {
    // Clear every slot first so a default shortcut held by another slot
    // (e.g. default main bound to a delay slot) does not self-conflict.
    hotkeysHandler.apply({
      main: null,
      delay3: null,
      delay5: null,
      recapture: null,
    });
    const failures = hotkeysHandler.apply({
      main: defaultPrefs.capture.hotkey,
      delay3: defaultPrefs.capture.hotkeyDelay3 ?? null,
      delay5: defaultPrefs.capture.hotkeyDelay5 ?? null,
      recapture: defaultPrefs.capture.hotkeyRecapture ?? null,
    });
    if (failures.length > 0) {
      log.warn(
        'Failed to re-register default shortcuts after reset:',
        failures,
      );
    }
  }
  applyPostSaveSideEffects(defaultPrefs, {
    refreshHotkeys: true,
    applyLoginItem: true,
    applyTray: true,
  });
  log.info('Preferences reset to defaults');
  return defaultPrefs;
}

export default function registerPreferencesIpcHandlers() {
  ipcMain.handle('get-preferences', async (): Promise<AppPreferences> => {
    try {
      return await loadPreferences();
    } catch (error) {
      log.error('Failed to get preferences:', error);
      throw error;
    }
  });

  ipcMain.handle(
    'set-preferences',
    (_event, request: unknown): Promise<SetPreferencesResponse> =>
      applyPreferencesUpdate(request),
  );

  ipcMain.handle(
    'import-background-image',
    async (_event, request: unknown): Promise<ImportBackgroundResponse> => {
      const bytes = isPlainObject(request) ? request.bytes : undefined;
      if (!(bytes instanceof Uint8Array)) {
        return { ok: false, error: 'No image was given.' };
      }
      try {
        return { ok: true, image: await saveBackgroundImage(bytes) };
      } catch (error) {
        log.warn('Failed to import a background image:', error);
        return { ok: false, error: messageOf(error) };
      }
    },
  );

  ipcMain.handle('open-preferences-window', async (): Promise<boolean> => {
    try {
      await createPreferencesWindow();
      return true;
    } catch (error) {
      log.error('Failed to open preferences window:', error);
      return false;
    }
  });

  ipcMain.handle('reset-preferences', async (): Promise<AppPreferences> => {
    try {
      return await applyPreferencesReset();
    } catch (error) {
      log.error('Failed to reset preferences:', error);
      throw error;
    }
  });
}
