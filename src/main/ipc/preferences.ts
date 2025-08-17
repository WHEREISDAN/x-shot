import { app, ipcMain } from 'electron';
import log from 'electron-log';
import type {
  AppPreferences,
  SetPreferencesRequest,
} from '../../shared/ipc-types';
import {
  loadPreferences,
  updatePreferences,
  resetPreferences,
} from '../preferences';
import { createPreferencesWindow } from '../windows';

// Callback for when hotkey changes
let onHotkeyChange: ((newHotkey: string) => void) | null = null;

// Callback for when tray visibility changes
let onTrayVisibilityChange: ((show: boolean) => void) | null = null;

export function setHotkeyChangeCallback(callback: (newHotkey: string) => void) {
  onHotkeyChange = callback;
}

export function setTrayVisibilityChangeCallback(
  callback: (show: boolean) => void,
) {
  onTrayVisibilityChange = callback;
}

export default function registerPreferencesIpcHandlers() {
  // Get current preferences
  ipcMain.handle('get-preferences', async (): Promise<AppPreferences> => {
    try {
      return await loadPreferences();
    } catch (error) {
      log.error('Failed to get preferences:', error);
      throw error;
    }
  });

  // Update preferences
  ipcMain.handle(
    'set-preferences',
    async (_event, request: SetPreferencesRequest): Promise<boolean> => {
      try {
        await updatePreferences(request.preferences);

        // Handle special system preferences that require immediate action
        if (request.preferences.system?.launchAtStartup !== undefined) {
          app.setLoginItemSettings({
            openAtLogin: request.preferences.system.launchAtStartup,
            name: 'X-Shot',
          });
        }

        // Handle hotkey changes
        if (request.preferences.capture?.hotkey && onHotkeyChange) {
          onHotkeyChange(request.preferences.capture.hotkey);
        }

        // Handle tray visibility changes
        if (
          request.preferences.system?.showInTray !== undefined &&
          onTrayVisibilityChange
        ) {
          onTrayVisibilityChange(request.preferences.system.showInTray);
        }

        log.info('Preferences updated successfully');
        return true;
      } catch (error) {
        log.error('Failed to set preferences:', error);
        return false;
      }
    },
  );

  // Open preferences window
  ipcMain.handle('open-preferences-window', async (): Promise<boolean> => {
    try {
      await createPreferencesWindow();
      return true;
    } catch (error) {
      log.error('Failed to open preferences window:', error);
      return false;
    }
  });

  // Reset preferences to defaults
  ipcMain.handle('reset-preferences', async (): Promise<AppPreferences> => {
    try {
      const defaultPrefs = await resetPreferences();
      log.info('Preferences reset to defaults');
      return defaultPrefs;
    } catch (error) {
      log.error('Failed to reset preferences:', error);
      throw error;
    }
  });
}
