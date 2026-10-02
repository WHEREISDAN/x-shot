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
import registerScreenPermissionHandlers from './screen-permission';
import { handleAssetProtocol, registerAssetScheme } from './asset-protocol';
import installE2eHooks from './e2e-hooks';
import registerScreenshotIpcHandlers from './ipc/screenshot';
import registerWindowIpcHandlers, {
  setupWindowStateEvents,
} from './ipc/window';
import registerPreferencesIpcHandlers, {
  setHotkeysHandler,
  setTrayVisibilityChangeCallback,
} from './ipc/preferences';
import {
  DEFAULT_SCREENSHOT_ACCELERATOR,
  unregisterAllHotkeys,
  updateRegisteredHotkeys,
} from './hotkeys';
import {
  flushPreferences,
  getBackgroundStore,
  loadPreferences,
} from './preferences';
import { captureAssets } from './capture-assets';
import {
  cancelCapture,
  scheduleCapture,
  startCapture,
} from './capture-coordinator';
import { recaptureLastSelection } from './capture-actions';

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
registerAssetScheme();
installE2eHooks();

app.on('window-all-closed', () => {
  if (!isTrayVisible()) {
    app.quit();
  }
});

app
  .whenReady()
  .then(async () => {
    handleAssetProtocol({
      captures: captureAssets,
      backgrounds: getBackgroundStore(),
    });
    // Register IPC handlers first; this also configures the coordinator.
    registerFileIpcHandlers();
    registerScreenshotIpcHandlers();
    registerWindowIpcHandlers();
    registerPreferencesIpcHandlers();
    registerScreenPermissionHandlers();

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
      runDetached(recaptureLastSelection());
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

    // Changed shortcuts are registered before they are saved, so a taken
    // one is refused and the previous one keeps working.
    setHotkeysHandler({
      apply: (changes) =>
        updateRegisteredHotkeys(
          {
            ...(changes.main !== undefined ? { main: changes.main } : {}),
            ...(changes.delay3 !== undefined
              ? { delay3: { accelerator: changes.delay3, delayMs: 3000 } }
              : {}),
            ...(changes.delay5 !== undefined
              ? { delay5: { accelerator: changes.delay5, delayMs: 5000 } }
              : {}),
            ...(changes.recapture !== undefined
              ? { recapture: changes.recapture }
              : {}),
          },
          {
            triggerMain: triggerScreenshot,
            triggerDelay: triggerDelayedScreenshot,
            triggerRecapture,
          },
        ),
      saved: () => {
        // Keep tray and menu accelerators in sync with preferences
        refreshTrayMenu(
          getMainWindow,
          triggerTrayScreenshot,
          triggerRecapture,
        ).catch(() => {});
        const win = getMainWindow();
        if (win) refreshApplicationMenu(win).catch(() => {});
      },
    });

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
    });
  })
  .catch((err) => log.error(err));

app.on('render-process-gone', () => {
  cancelCapture('renderer-crash').catch((err) =>
    log.error('Failed to cancel capture after renderer crash:', err),
  );
});

let preferencesFlushed = false;
app.on('before-quit', (event) => {
  cancelCapture('app-quit').catch((err) =>
    log.error('Failed to cancel capture on quit:', err),
  );
  // Quit only once pending preference writes are on disk.
  if (preferencesFlushed) return;
  event.preventDefault();
  preferencesFlushed = true;
  const flushThenQuit = async () => {
    try {
      await flushPreferences();
    } catch (err) {
      log.error('Failed to flush preferences on quit:', err);
    }
    app.quit();
  };
  flushThenQuit().catch(() => {});
});

app.on('will-quit', () => {
  unregisterAllHotkeys();
});
