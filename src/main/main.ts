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
import { createTray } from './tray';
import registerFileIpcHandlers from './ipc/files';
import registerScreenshotIpcHandlers from './ipc/screenshot';
import registerWindowIpcHandlers from './ipc/window';
import {
  DEFAULT_SCREENSHOT_ACCELERATOR,
  registerScreenshotHotkey,
  unregisterAllHotkeys,
} from './hotkeys';

ipcMain.on('ipc-example', async (event, arg) => {
  const msgTemplate = (pingPong: string) => `IPC test: ${pingPong}`;
  console.log(msgTemplate(arg));
  event.reply('ipc-example', msgTemplate('pong'));
});
app.on('window-all-closed', () => {
  // Respect the OSX convention of having the application in memory even
  // after all windows have been closed
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app
  .whenReady()
  .then(() => {
    const triggerScreenshot = async () => {
      const main = getMainWindow();
      if (main) main.hide();
      if (areOverlaysOpen()) showScreenshotOverlays();
      else await createScreenshotOverlays();
    };

    createTray(getMainWindow, triggerScreenshot);
    registerScreenshotHotkey(DEFAULT_SCREENSHOT_ACCELERATOR, triggerScreenshot);
    createMainWindow();
    registerFileIpcHandlers();
    registerScreenshotIpcHandlers();
    registerWindowIpcHandlers();
    app.on('activate', () => {
      // On macOS it's common to re-create a window in the app when the
      // dock icon is clicked and there are no other windows open.
      if (getMainWindow() === null) createMainWindow();
    });
  })
  .catch(console.log);

app.on('will-quit', () => {
  unregisterAllHotkeys();
});
