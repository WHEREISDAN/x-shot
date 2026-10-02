import { expect, test } from '@playwright/test';
import {
  launchPackagedApp,
  openOverlays,
  overlayPages,
  stubScreenAccess,
  type PackagedApp,
} from './packaged-app';

const SETTINGS_URL =
  'x-apple.systempreferences:com.apple.preference.security?Privacy_ScreenCapture';

// Playwright sometimes loses an evaluate's result in main ("Resulting
// promise was garbage collected"); the probe has no side effects, so retry.
const PLAYWRIGHT_LOST_RESULT = 'Resulting promise was garbage collected';

async function preferencesVisible(
  packaged: PackagedApp,
  attempt = 1,
): Promise<boolean> {
  try {
    return await packaged.app.evaluate(({ BrowserWindow }) =>
      BrowserWindow.getAllWindows().some(
        (win) =>
          win.webContents.getURL().includes('#/preferences') && win.isVisible(),
      ),
    );
  } catch (error) {
    const lost = String(error).includes(PLAYWRIGHT_LOST_RESULT);
    if (!lost || attempt >= 3) throw error;
    return preferencesVisible(packaged, attempt + 1);
  }
}

async function recordOpenedUrls({ app }: PackagedApp): Promise<void> {
  await app.evaluate(({ shell }) => {
    const store = global as unknown as { xshotOpened: string[] };
    store.xshotOpened = [];
    Object.assign(shell, {
      openExternal: async (url: string) => {
        store.xshotOpened.push(url);
      },
    });
  });
}

async function openedUrls({ app }: PackagedApp): Promise<string[]> {
  return app.evaluate(
    () => (global as unknown as { xshotOpened: string[] }).xshotOpened,
  );
}

test.describe('capture overlays', () => {
  let packaged: PackagedApp | undefined;

  test.beforeEach(async () => {
    packaged = await launchPackagedApp({
      system: { launchAtStartup: false, showInTray: false },
      pii: { autoDetect: false },
    });
  });

  test.afterEach(async () => {
    await packaged?.close();
    packaged = undefined;
  });

  test('every overlay has Cancel and Escape closes them all', async () => {
    const current = packaged as PackagedApp;
    await stubScreenAccess(current, 'granted');
    const overlays = await openOverlays(current);

    await Promise.all(
      overlays.map((overlay) =>
        expect(overlay.getByRole('button', { name: 'Cancel' })).toBeVisible(),
      ),
    );
    // Only keydown: the overlay can close before a keyup would arrive.
    await overlays[0].keyboard.down('Escape');

    await expect.poll(() => overlayPages(current).length).toBe(0);
  });

  test('Preferences is hidden during a capture and comes back after', async () => {
    const current = packaged as PackagedApp;
    await stubScreenAccess(current, 'granted');
    await current.window.evaluate(() =>
      window.electron.ipcRenderer.invoke('open-preferences-window', undefined),
    );
    await expect.poll(() => preferencesVisible(current)).toBe(true);

    const overlays = await openOverlays(current);
    expect(await preferencesVisible(current)).toBe(false);

    await overlays[0].getByRole('button', { name: 'Cancel' }).click();
    await expect.poll(() => overlayPages(current).length).toBe(0);
    await expect.poll(() => preferencesVisible(current)).toBe(true);
  });

  test('an empty selection is reported, not ignored', async () => {
    const current = packaged as PackagedApp;
    await stubScreenAccess(current, 'granted');
    const [overlay] = await openOverlays(current);

    // A click without a drag leaves a zero-size selection.
    await overlay.mouse.click(400, 300);
    await overlay.getByRole('button', { name: '✓ Capture' }).click();

    await expect.poll(() => overlayPages(current).length).toBe(0);
    await expect(current.window.getByRole('alert')).toContainText(
      'selected area is empty',
    );
  });

  test('with Screen Recording denied on macOS, no overlay opens', async () => {
    test.skip(process.platform !== 'darwin', 'macOS-only permission');
    const current = packaged as PackagedApp;
    await stubScreenAccess(current, 'denied');
    await recordOpenedUrls(current);

    await current.window.evaluate(() =>
      window.electron.ipcRenderer.sendMessage('screenshot-capture', undefined),
    );
    const alert = current.window.getByRole('alert');
    await expect(alert).toContainText('Screen Recording');
    await current.window.waitForTimeout(1_000);
    expect(overlayPages(current)).toHaveLength(0);

    await alert.getByRole('button', { name: 'Open System Settings' }).click();
    await expect.poll(() => openedUrls(current)).toEqual([SETTINGS_URL]);
  });
});
