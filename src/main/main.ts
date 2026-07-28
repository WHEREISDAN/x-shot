/* eslint global-require: off, no-console: off, promise/always-return: off */

/**
 * This module executes inside of electron's main process. You can start
 * electron renderer process from here and communicate with the other processes
 * through IPC.
 *
 * When running `npm run build` or `npm run build:main`, this file is compiled to
 * `./src/main.js` using webpack. This gives us some performance wins.
 */
import { app, ipcMain, screen } from 'electron';
import log from 'electron-log';
import type { LogMessage } from '../shared/ipc-types';
import { createMainWindow, getMainWindow } from './windows';
import {
  createTray,
  updateTrayVisibility,
  isTrayVisible,
  refreshTrayMenu,
} from './tray';
import { refreshApplicationMenu } from './menu';
import registerFileIpcHandlers from './ipc/files';
import registerScreenshotIpcHandlers from './ipc/screenshot';
import registerWindowIpcHandlers, {
  setupWindowStateEvents,
} from './ipc/window';
import registerPreferencesIpcHandlers, {
  setHotkeyChangeCallback,
  setTrayVisibilityChangeCallback,
  setDelayHotkeysChangeCallback,
} from './ipc/preferences';
import {
  DEFAULT_SCREENSHOT_ACCELERATOR,
  unregisterAllHotkeys,
  updateRegisteredHotkeys,
} from './hotkeys';
import { loadPreferences } from './preferences';
import {
  cancelCapture,
  scheduleCapture,
  startCapture,
  startRecapture,
} from './capture-coordinator';

ipcMain.on('ipc-example', async (event, arg) => {
  const msgTemplate = (pingPong: string) => `IPC test: ${pingPong}`;
  log.info(msgTemplate(arg));
  event.reply('ipc-example', msgTemplate('pong'));
});

// Centralized renderer-to-main logging sink
ipcMain.on('log', (_event, payload: LogMessage) => {
  const { level, message, scope, meta } = payload || {};
  const prefix = scope ? `[${scope}] ` : '';
  switch (level) {
    case 'debug':
      log.debug(prefix + message, meta ?? '');
      break;
    case 'info':
      log.info(prefix + message, meta ?? '');
      break;
    case 'warn':
      log.warn(prefix + message, meta ?? '');
      break;
    case 'error':
      log.error(prefix + message, meta ?? '');
      break;
    default:
      log.info(prefix + message, meta ?? '');
  }
});
app.on('window-all-closed', () => {
  if (!isTrayVisible()) {
    app.quit();
  }
});

app
  .whenReady()
  .then(async () => {
    // Register IPC handlers first; this also configures the coordinator.
    registerFileIpcHandlers();
    registerScreenshotIpcHandlers();
    registerWindowIpcHandlers();
    registerPreferencesIpcHandlers();

    const runDetached = (work: Promise<unknown>) => {
      work.catch((err) => log.error('Capture coordinator error:', err));
    };
    const triggerScreenshot = () => {
      runDetached(startCapture('hotkey'));
    };
    const triggerTrayScreenshot = () => {
      runDetached(startCapture('tray'));
    };
    const triggerDelayedScreenshot = (delayMs: number) => {
      scheduleCapture(delayMs, 'delayed');
    };
    const triggerRecapture = () => {
      loadPreferences()
        .then(({ capture }) => {
          const last = capture.lastSelection;
          if (last) {
            runDetached(
              startRecapture({
                x: last.x,
                y: last.y,
                width: last.width,
                height: last.height,
              }),
            );
          }
        })
        .catch((err) => log.warn('Failed to re-capture last area', err));
    };

    // Load preferences to get the correct settings
    const preferences = await loadPreferences();

    // Create tray only if enabled in preferences
    if (preferences.system.showInTray) {
      createTray(getMainWindow, triggerTrayScreenshot, triggerRecapture);
    }

    const hotkey = preferences.capture.hotkey || DEFAULT_SCREENSHOT_ACCELERATOR;
    // Register main + delayed hotkeys
    updateRegisteredHotkeys(
      {
        main: hotkey,
        delay3: {
          accelerator: preferences.capture.hotkeyDelay3 || null,
          delayMs: 3000,
        },
        delay5: {
          accelerator: preferences.capture.hotkeyDelay5 || null,
          delayMs: 5000,
        },
        recapture: preferences.capture.hotkeyRecapture || null,
      },
      {
        triggerMain: triggerScreenshot,
        triggerDelay: triggerDelayedScreenshot,
        triggerRecapture,
      },
    );

    createMainWindow();

    // Set up window state events after creating the main window
    setupWindowStateEvents();

    // Set up hotkey change callback
    setHotkeyChangeCallback((newHotkey: string) => {
      updateRegisteredHotkeys(
        { main: newHotkey },
        {
          triggerMain: triggerScreenshot,
          triggerDelay: triggerDelayedScreenshot,
          triggerRecapture,
        },
      );
      const win = getMainWindow();
      if (win) refreshApplicationMenu(win).catch(() => {});
    });

    // Set up delay hotkeys change callback
    setDelayHotkeysChangeCallback(
      ({ hotkeyDelay3, hotkeyDelay5, hotkeyRecapture }) => {
        updateRegisteredHotkeys(
          {
            delay3: { accelerator: hotkeyDelay3 || null, delayMs: 3000 },
            delay5: { accelerator: hotkeyDelay5 || null, delayMs: 5000 },
            recapture: hotkeyRecapture || null,
          },
          {
            triggerMain: triggerScreenshot,
            triggerDelay: triggerDelayedScreenshot,
            triggerRecapture,
          },
        );
        // Keep tray menu accelerators in sync with preferences
        refreshTrayMenu(
          getMainWindow,
          triggerTrayScreenshot,
          triggerRecapture,
        ).catch(() => {});
        const win = getMainWindow();
        if (win) refreshApplicationMenu(win).catch(() => {});
      },
    );

    // Set up tray visibility change callback
    setTrayVisibilityChangeCallback((show: boolean) => {
      updateTrayVisibility(
        show,
        getMainWindow,
        triggerTrayScreenshot,
        triggerRecapture,
      );
    });
    // Display topology changes invalidate snapshots and overlay geometry.
    const cancelForDisplayChange = () => {
      runDetached(cancelCapture('display-changed'));
    };
    screen.on('display-added', cancelForDisplayChange);
    screen.on('display-removed', cancelForDisplayChange);

    app.on('activate', () => {
      if (getMainWindow() === null) createMainWindow();
      app.disableHardwareAcceleration();
    });
  })
  .catch((err) => log.error(err));

app.on('render-process-gone', () => {
  cancelCapture('renderer-crash').catch((err) =>
    log.error('Failed to cancel capture after renderer crash:', err),
  );
});

app.on('before-quit', () => {
  cancelCapture('app-quit').catch((err) =>
    log.error('Failed to cancel capture on quit:', err),
  );
});

app.on('will-quit', () => {
  unregisterAllHotkeys();
});
