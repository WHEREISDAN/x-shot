import { app, screen } from 'electron';
import log from 'electron-log';
import { createMainWindow, getMainWindow, showMainWindow } from './windows';
import {
  createTray,
  updateTrayVisibility,
  isTrayVisible,
  refreshTrayMenu,
} from './tray';
import { refreshApplicationMenu } from './menu';
import registerFileIpcHandlers from './ipc/files';
import registerLogIpcHandler from './ipc/log';
import registerScreenPermissionHandlers from './screen-permission';
import { handleAssetProtocol, registerAssetScheme } from './asset-protocol';
import installE2eHooks from './e2e-hooks';
import installNavigationGuards from './navigation-guards';
import installPreferencesFlush from './preferences-flush';
import checkForUpdatesOnce from './updates';
import registerScreenshotIpcHandlers from './ipc/screenshot';
import registerWindowIpcHandlers from './ipc/window';
import registerPreferencesIpcHandlers, {
  setHotkeysHandler,
  setTrayVisibilityChangeCallback,
} from './ipc/preferences';
import {
  DEFAULT_SCREENSHOT_ACCELERATOR,
  unregisterAllHotkeys,
  updateRegisteredHotkeys,
  type HotkeyTriggers,
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

const runDetached = (work: Promise<unknown>) => {
  work.catch((err) => log.error('Capture coordinator error:', err));
};

const hotkeyTriggers: HotkeyTriggers = {
  triggerMain: () => runDetached(startCapture('hotkey')),
  triggerDelay: (delayMs: number) => scheduleCapture(delayMs, 'delayed'),
  triggerRecapture: () => runDetached(recaptureLastSelection()),
};

/** Keeps the application menu and tray in step with saved preferences. */
const refreshMenus = () => {
  refreshTrayMenu().catch(() => undefined);
  refreshApplicationMenu().catch((err) =>
    log.error('Failed to build the application menu:', err),
  );
};

async function startApp(): Promise<void> {
  handleAssetProtocol({
    captures: captureAssets,
    backgrounds: getBackgroundStore(),
  });
  // Register IPC handlers first; this also configures the coordinator.
  registerLogIpcHandler();
  registerFileIpcHandlers();
  registerScreenshotIpcHandlers();
  registerWindowIpcHandlers();
  registerPreferencesIpcHandlers();
  registerScreenPermissionHandlers();

  const preferences = await loadPreferences();
  if (preferences.system.showInTray) createTray();

  updateRegisteredHotkeys(
    {
      main: preferences.capture.hotkey || DEFAULT_SCREENSHOT_ACCELERATOR,
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
    hotkeyTriggers,
  );

  createMainWindow();
  // A bad saved shortcut must not stop the rest of startup.
  await refreshApplicationMenu().catch((err) =>
    log.error('Failed to build the application menu:', err),
  );

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
        hotkeyTriggers,
      ),
    saved: refreshMenus,
  });
  setTrayVisibilityChangeCallback(updateTrayVisibility);

  // Display topology changes invalidate snapshots and overlay geometry.
  const cancelForDisplayChange = () => {
    runDetached(cancelCapture('display-changed'));
  };
  screen.on('display-added', cancelForDisplayChange);
  screen.on('display-removed', cancelForDisplayChange);

  app.on('activate', () => {
    if (getMainWindow() === null) createMainWindow();
  });

  await checkForUpdatesOnce();
}

process.on('unhandledRejection', (reason) => {
  log.error('Unhandled promise rejection:', reason);
});

// A second launch hands over to the running app and exits.
if (!app.requestSingleInstanceLock()) {
  app.exit(0);
} else {
  app.on('second-instance', () => showMainWindow());

  installE2eHooks();
  installNavigationGuards();
  installPreferencesFlush(flushPreferences);
  registerAssetScheme();

  app.on('window-all-closed', () => {
    if (!isTrayVisible()) app.quit();
  });

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

  app
    .whenReady()
    .then(startApp)
    .catch((err) => log.error('Startup failed:', err));
}
