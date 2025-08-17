/* eslint global-require: off, no-console: off, promise/always-return: off */

/**
 * This module executes inside of electron's main process. You can start
 * electron renderer process from here and communicate with the other processes
 * through IPC.
 *
 * When running `npm run build` or `npm run build:main`, this file is compiled to
 * `./src/main.js` using webpack. This gives us some performance wins.
 */
import { app, ipcMain } from 'electron';
import {
  createMainWindow,
  getMainWindow,
  createScreenshotOverlays,
  showScreenshotOverlays,
  areOverlaysOpen,
} from './windows';
import { createTray, updateTrayVisibility, isTrayVisible } from './tray';
import registerFileIpcHandlers from './ipc/files';
import registerScreenshotIpcHandlers from './ipc/screenshot';
import registerWindowIpcHandlers, {
  setupWindowStateEvents,
} from './ipc/window';
import registerPreferencesIpcHandlers, {
  setHotkeyChangeCallback,
  setTrayVisibilityChangeCallback,
} from './ipc/preferences';
import {
  DEFAULT_SCREENSHOT_ACCELERATOR,
  registerScreenshotHotkey,
  unregisterAllHotkeys,
} from './hotkeys';
import { loadPreferences } from './preferences';

ipcMain.on('ipc-example', async (event, arg) => {
  const msgTemplate = (pingPong: string) => `IPC test: ${pingPong}`;
  console.log(msgTemplate(arg));
  event.reply('ipc-example', msgTemplate('pong'));
});
app.on('window-all-closed', () => {
  // Only quit if tray is not visible
  // When tray is visible, keep app running for both Windows and macOS
  if (!isTrayVisible()) {
    app.quit();
  }
});

app
  .whenReady()
  .then(async () => {
    const triggerScreenshot = async () => {
      const main = getMainWindow();
      if (main) main.hide();
      if (areOverlaysOpen()) showScreenshotOverlays();
      else await createScreenshotOverlays();
    };

    // Register IPC handlers first
    registerFileIpcHandlers();
    registerScreenshotIpcHandlers();
    registerWindowIpcHandlers();
    registerPreferencesIpcHandlers();

    // Load preferences to get the correct settings
    const preferences = await loadPreferences();

    // Create tray only if enabled in preferences
    if (preferences.system.showInTray) {
      createTray(getMainWindow, triggerScreenshot);
    }

    const hotkey = preferences.capture.hotkey || DEFAULT_SCREENSHOT_ACCELERATOR;
    registerScreenshotHotkey(hotkey, triggerScreenshot);

    createMainWindow();

    // Set up window state events after creating the main window
    setupWindowStateEvents();

    // Set up hotkey change callback
    setHotkeyChangeCallback((newHotkey: string) => {
      registerScreenshotHotkey(newHotkey, triggerScreenshot);
    });

    // Set up tray visibility change callback
    setTrayVisibilityChangeCallback((show: boolean) => {
      updateTrayVisibility(show, getMainWindow, triggerScreenshot);
    });
    app.on('activate', () => {
      // On macOS it's common to re-create a window in the app when the
      // dock icon is clicked and there are no other windows open.
      if (getMainWindow() === null) createMainWindow();
      app.disableHardwareAcceleration();
    });
  })
  .catch(console.log);

app.on('will-quit', () => {
  unregisterAllHotkeys();
});
