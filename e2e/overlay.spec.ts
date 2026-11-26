import path from 'path';
import { expect, test, type Locator } from '@playwright/test';
import {
  HIDDEN,
  SHOWN,
  displayCount,
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

const stubOverlaySources = (packaged: PackagedApp) =>
  stubCaptureSources(packaged, {
    screenPng: SCREEN_FIXTURE,
    window: { noise: { width: 64, height: 64 } },
  });

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

interface Bounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface OverlayGeometry {
  displayId: number;
  visible: boolean;
  bounds: Bounds;
  contentBounds: Bounds;
  displayBounds: Bounds | null;
  isSimpleFullScreen: boolean;
}

/**
 * Under WM-less Xvfb on Linux CI, X11/Chromium can report a frameless
 * fullscreen window as 1 px smaller than the screen (e.g. 1279x1023 for
 * 1280x1024) while x and y remain exact. macOS and Windows stay strict.
 */
function expectSizeMatchesDisplay(
  actual: { width: number; height: number },
  display: { width: number; height: number },
): void {
  if (process.platform === 'linux') {
    expect(actual.width).toBeGreaterThanOrEqual(display.width - 1);
    expect(actual.width).toBeLessThanOrEqual(display.width);
    expect(actual.height).toBeGreaterThanOrEqual(display.height - 1);
    expect(actual.height).toBeLessThanOrEqual(display.height);
    return;
  }
  expect(actual.width).toBe(display.width);
  expect(actual.height).toBe(display.height);
}

function expectBoundsMatchDisplay(actual: Bounds, display: Bounds): void {
  expect(actual.x).toBe(display.x);
  expect(actual.y).toBe(display.y);
  expectSizeMatchesDisplay(actual, display);
}

async function overlayGeometries(
  packaged: PackagedApp,
  attempt = 1,
): Promise<OverlayGeometry[]> {
  try {
    return await packaged.app.evaluate(({ BrowserWindow, screen }) => {
      const displays = screen.getAllDisplays();
      return BrowserWindow.getAllWindows()
        .filter(
          (win) =>
            !win.webContents.isDestroyed() &&
            win.webContents.getURL().includes('#/screenshot'),
        )
        .map((win) => {
          const url = win.webContents.getURL();
          const queryIndex = url.indexOf('?');
          const params = new URLSearchParams(
            queryIndex >= 0 ? url.slice(queryIndex + 1) : '',
          );
          const displayId = Number(params.get('displayId'));
          const display = displays.find((d) => d.id === displayId);
          return {
            displayId,
            visible: win.isVisible(),
            bounds: win.getBounds(),
            contentBounds: win.getContentBounds(),
            displayBounds: display?.bounds ?? null,
            isSimpleFullScreen:
              process.platform === 'darwin' ? win.isSimpleFullScreen() : false,
          };
        });
    });
  } catch (error) {
    const lost = String(error).includes(PLAYWRIGHT_LOST_RESULT);
    if (!lost || attempt >= 3) throw error;
    return overlayGeometries(packaged, attempt + 1);
  }
}

async function stubFocusedDisplay(
  { app }: PackagedApp,
  index: number,
): Promise<void> {
  await app.evaluate(({ screen }, targetIndex) => {
    const target = screen.getAllDisplays()[targetIndex];
    if (!target) {
      throw new Error(`No display at index ${targetIndex}`);
    }
    Object.assign(screen, { getDisplayNearestPoint: () => target });
  }, index);
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
    await stubOverlaySources(current);
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

  test('every overlay covers its full display bounds regardless of which display is active', async () => {
    const current = packaged as PackagedApp;
    await stubScreenAccess(current, 'granted');
    await stubOverlaySources(current);
    // Wait for the editor's initial ready-to-show so each iteration hides and
    // restores it cleanly instead of racing with cancel cleanup.
    await expect
      .poll(async () => (await windowLooks(current)).editor)
      .toEqual(SHOWN);
    const totalDisplays = await displayCount(current);
    const displayIndices = Array.from({ length: totalDisplays }, (_, i) => i);

    await displayIndices.reduce(async (previous, focusedIndex) => {
      await previous;
      await stubFocusedDisplay(current, focusedIndex);
      const overlays = await openOverlays(current);
      expect((await windowLooks(current)).editor).toEqual(HIDDEN);

      let finalGeos: OverlayGeometry[] = [];
      await expect(async () => {
        finalGeos = await overlayGeometries(current);
        expect(finalGeos).toHaveLength(totalDisplays);
        finalGeos.forEach((geo) => {
          expect(geo.visible).toBe(true);
          expect(geo.displayBounds).not.toBeNull();
          const displayBounds = geo.displayBounds as Bounds;
          expectBoundsMatchDisplay(geo.bounds, displayBounds);
          expectBoundsMatchDisplay(geo.contentBounds, displayBounds);
          if (process.platform === 'darwin') {
            expect(geo.isSimpleFullScreen).toBe(false);
          }
        });
      }).toPass({ timeout: 10_000 });

      await Promise.all(
        overlays.map(async (overlay) => {
          const layout = await overlay.evaluate(() => {
            const dock = document.querySelector('[data-quick-dock="1"]');
            const rect = dock?.getBoundingClientRect();
            return {
              width: window.innerWidth,
              height: window.innerHeight,
              dockTop: rect?.top ?? -1,
              dockBottom: rect?.bottom ?? Number.POSITIVE_INFINITY,
            };
          });
          const queryIndex = overlay.url().indexOf('?');
          const params = new URLSearchParams(
            queryIndex >= 0 ? overlay.url().slice(queryIndex + 1) : '',
          );
          const displayId = Number(params.get('displayId'));
          const geo = finalGeos.find((g) => g.displayId === displayId);
          expect(geo?.displayBounds).toBeTruthy();
          expectSizeMatchesDisplay(layout, geo?.displayBounds as Bounds);
          expect(layout.dockTop).toBeGreaterThanOrEqual(0);
          expect(layout.dockBottom).toBeLessThanOrEqual(layout.height);
        }),
      );

      await overlays[0].getByRole('button', { name: 'Cancel' }).click();
      await expect.poll(() => overlayPages(current).length).toBe(0);
      await expect
        .poll(async () => (await windowLooks(current)).editor)
        .toEqual(SHOWN);
    }, Promise.resolve());
  });

  test('Preferences is hidden during a capture and comes back after', async () => {
    const current = packaged as PackagedApp;
    await stubScreenAccess(current, 'granted');
    await stubOverlaySources(current);
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
    await stubOverlaySources(current);
    const [overlay] = await openOverlays(current);

    // A click without a drag leaves a zero-size selection.
    await overlay.mouse.click(400, 300);
    await overlay.getByRole('button', { name: 'Capture', exact: true }).click();

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
