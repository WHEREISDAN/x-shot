import path from 'path';
import { expect, test, type Locator } from '@playwright/test';
import {
  HIDDEN,
  SHOWN,
  editorFor,
  launchPackagedApp,
  openOverlays,
  overlayPages,
  stubScreenAccess,
  windowLooks,
  type PackagedApp,
} from './packaged-app';
import { openedUrls, recordOpenedUrls } from './external-links';
import {
  paintScreens,
  shownCaptureSize,
  shownSessionId,
  stubCaptureSources,
} from './capture-stubs';

const SCREEN_FIXTURE = path.join(__dirname, 'fixtures', 'ocr-pii-screen.png');

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
          !win.webContents.isDestroyed() &&
          win.webContents.getURL().includes('#/preferences') &&
          win.isVisible(),
      ),
    );
  } catch (error) {
    const lost = String(error).includes(PLAYWRIGHT_LOST_RESULT);
    if (!lost || attempt >= 3) throw error;
    return preferencesVisible(packaged, attempt + 1);
  }
}

/** Mean RGB brightness (0-255) of the image an <img> shows. */
async function brightnessOf(image: Locator): Promise<number> {
  return image.evaluate(async (img: HTMLImageElement) => {
    const blob = await (await fetch(img.src)).blob();
    const bitmap = await createImageBitmap(blob);
    const canvas = new OffscreenCanvas(bitmap.width, bitmap.height);
    const context = canvas.getContext(
      '2d',
    ) as OffscreenCanvasRenderingContext2D;
    context.drawImage(bitmap, 0, 0);
    const { data } = context.getImageData(0, 0, bitmap.width, bitmap.height);
    let total = 0;
    for (let i = 0; i < data.length; i += 4) {
      total += (data[i] + data[i + 1] + data[i + 2]) / 3;
    }
    return total / (data.length / 4);
  });
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
    await expect
      .poll(() => windowLooks(current))
      .toEqual({ editor: SHOWN, preferences: SHOWN });
  });

  test('a display capture keeps the screen as it was before the overlays', async () => {
    const current = packaged as PackagedApp;
    await stubScreenAccess(current, 'granted');
    // A near-white screen; see paintScreens below.
    await stubCaptureSources(current, {
      screenPng: SCREEN_FIXTURE,
      window: { noise: { width: 64, height: 64 } },
    });
    await current.window.evaluate(() =>
      window.electron.ipcRenderer.invoke('open-preferences-window', undefined),
    );
    await expect
      .poll(() => windowLooks(current))
      .toEqual({ editor: SHOWN, preferences: SHOWN });
    const before = await shownSessionId(current.window);

    const [overlay] = await openOverlays(current);
    expect(await windowLooks(current)).toEqual({
      editor: HIDDEN,
      preferences: HIDDEN,
    });
    // From here on a live capture returns black, standing in for a screen
    // that now shows the overlay.
    await paintScreens(current, 0);

    await overlay
      .getByRole('button', { name: 'Displays', exact: true })
      .click();
    const entry = overlay.getByRole('button', { name: 'Screen 1' });
    const preview = entry.getByRole('img', { name: 'Screen 1' });
    await expect(preview).toBeVisible();
    expect(await brightnessOf(preview)).toBeGreaterThan(200);
    await entry.click();

    await expect.poll(() => shownSessionId(current.window)).not.toBe(before);
    const sessionId = (await shownSessionId(current.window)) as string;
    expect(overlayPages(current)).toHaveLength(0);
    const display = await current.app.evaluate(({ screen }) => {
      const [first] = screen.getAllDisplays();
      return {
        width: Math.round(first.bounds.width * first.scaleFactor),
        height: Math.round(first.bounds.height * first.scaleFactor),
      };
    });
    expect(await shownCaptureSize(current.window, sessionId)).toEqual(display);
    const capture = editorFor(current.window, { sessionId }).getByAltText(
      'Screenshot',
    );
    expect(await brightnessOf(capture)).toBeGreaterThan(200);
    await expect
      .poll(() => windowLooks(current))
      .toEqual({ editor: SHOWN, preferences: SHOWN });
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
