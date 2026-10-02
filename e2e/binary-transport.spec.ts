import fs from 'fs';
import os from 'os';
import path from 'path';
import { expect, test, type Page } from '@playwright/test';
import {
  launchPackagedApp,
  openOverlays,
  recordCopies,
  recordedCopies,
  report,
  storedAssetCount,
  stubScreenAccess,
  type PackagedApp,
  type SeedPreferences,
} from './packaged-app';
import { ipcRecords, spyOnIpc } from './ipc-spy';
import {
  FAKE_WINDOW_ID,
  FAKE_WINDOW_NAME,
  captureWindowFromOverlay,
  requestedWindowSizes,
  shownCaptureSize,
  shownSessionId,
  stubCaptureSources,
  stubWindowFrameSize,
} from './capture-stubs';

const FIXTURES = path.join(__dirname, 'fixtures');
const WINDOW_FIXTURE = path.join(FIXTURES, 'ocr-pii.png');
const WINDOW_SIZE = { width: 1000, height: 420 };
const SCREEN_FIXTURE = path.join(FIXTURES, 'ocr-pii-screen.png');

const PREFERENCES: SeedPreferences = {
  system: { launchAtStartup: false, showInTray: false },
  pii: { autoDetect: false },
};

/** The overlay's frozen background image. */
const overlayBackground = (overlay: Page) =>
  overlay.locator('img[src^="xshot-asset://"]').first();

async function primaryScale({ app }: PackagedApp): Promise<number> {
  return app.evaluate(({ screen }) => screen.getPrimaryDisplay().scaleFactor);
}

test.describe('binary capture transport', () => {
  let packaged: PackagedApp | undefined;
  let dir: string;

  test.beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'xshot-binary-'));
  });

  test.afterEach(async () => {
    await packaged?.close();
    packaged = undefined;
    fs.rmSync(dir, { recursive: true, force: true });
  });

  test('no data: URL crosses IPC from overlay to saved file', async () => {
    packaged = await launchPackagedApp({
      ...PREFERENCES,
      capture: { defaultSaveLocation: dir },
      export: { autoSave: true, filenamePattern: 'export' },
    });
    const current = packaged;
    const page = current.window;
    await spyOnIpc(current);
    await recordCopies(current);
    await stubScreenAccess(current, 'granted');
    await stubCaptureSources(current, {
      screenPng: SCREEN_FIXTURE,
      window: { png: WINDOW_FIXTURE },
    });
    await stubWindowFrameSize(current, WINDOW_SIZE);

    const [overlay] = await openOverlays(current);
    // The frozen screen arrives through the protocol at full size.
    await expect
      .poll(() =>
        overlayBackground(overlay).evaluate(
          (img: HTMLImageElement) => img.naturalWidth,
        ),
      )
      .toBeGreaterThan(0);

    // So do the window list's previews.
    await overlay.getByRole('button', { name: 'Windows', exact: true }).click();
    const entry = overlay.getByRole('button', { name: FAKE_WINDOW_NAME });
    await expect(entry).toBeVisible();
    await expect
      .poll(() =>
        entry
          .locator('img')
          .first()
          .evaluate((img: HTMLImageElement) =>
            img.src.startsWith('xshot-asset://') ? img.naturalWidth : 0,
          ),
      )
      .toBeGreaterThan(0);

    const sessionId = await captureWindowFromOverlay(
      current,
      overlay,
      FAKE_WINDOW_ID,
    );
    // The window was requested and delivered at its native size.
    expect(await requestedWindowSizes(current)).toContainEqual(WINDOW_SIZE);
    expect(await shownCaptureSize(page, sessionId)).toEqual(WINDOW_SIZE);

    await page.getByRole('button', { name: 'Copy', exact: true }).click();
    await expect
      .poll(async () => (await recordedCopies(current)).length)
      .toBe(1);
    await page.getByRole('button', { name: 'Save', exact: true }).click();
    await expect(page.getByRole('status')).toContainText('Saved');
    expect(fs.existsSync(path.join(dir, 'export.png'))).toBe(true);

    const records = await ipcRecords(current);
    const seen = (direction: string, channel: string) =>
      records.some((r) => r.direction === direction && r.channel === channel);
    expect(seen('reply', 'get-display-snapshot')).toBe(true);
    expect(seen('reply', 'list-capture-sources')).toBe(true);
    expect(seen('reply', 'get-preferences')).toBe(true);
    expect(seen('send', 'screenshot-window')).toBe(true);
    expect(seen('to-renderer', 'capture-result')).toBe(true);
    expect(seen('invoke', 'copy-image')).toBe(true);
    expect(seen('invoke', 'save-image')).toBe(true);
    expect(records.filter((r) => r.hasDataUrl)).toEqual([]);
  });

  test('ten captures in a row keep one capture in main memory', async () => {
    packaged = await launchPackagedApp(PREFERENCES, {
      args: ['--js-flags=--expose-gc'],
    });
    const current = packaged;
    const size = { width: 1920, height: 1080 };
    await stubScreenAccess(current, 'granted');
    await stubCaptureSources(current, {
      screenPng: SCREEN_FIXTURE,
      window: { noise: size },
    });
    await stubWindowFrameSize(current, size);

    const captureOnce = async () => {
      const [overlay] = await openOverlays(current);
      const sessionId = await captureWindowFromOverlay(
        current,
        overlay,
        FAKE_WINDOW_ID,
      );
      expect(await shownCaptureSize(current.window, sessionId)).toEqual(size);
      return sessionId;
    };
    const mainMemory = () =>
      current.app.evaluate(async () => {
        // Two passes, so native-backed buffers freed by the first go too.
        const { gc } = global as unknown as { gc: () => void };
        gc();
        await new Promise((resolve) => {
          setTimeout(resolve, 200);
        });
        gc();
        // Electron main counts Buffers under external, not arrayBuffers.
        const usage = process.memoryUsage();
        return usage.heapUsed + usage.external;
      });

    await captureOnce();
    const captureBytes = await current.window.evaluate(async () => {
      const src = document
        .querySelector('[data-session-id] img[alt="Screenshot"]')
        ?.getAttribute('src');
      return src ? (await (await fetch(src)).arrayBuffer()).byteLength : 0;
    });
    expect(captureBytes).toBeGreaterThan(1_000_000);
    const before = await mainMemory();

    await Array.from({ length: 10 }).reduce<Promise<unknown>>(
      async (previous) => {
        await previous;
        await captureOnce();
      },
      Promise.resolve(),
    );
    const after = await mainMemory();

    report('main-memory', { captureBytes, before, after });
    expect(await storedAssetCount(current)).toBe(1);
    // Ten leaked captures would add ten times captureBytes.
    expect(after - before).toBeLessThan(captureBytes + 4 * 1024 * 1024);

    // The measure does see such a leak, despite some GC noise.
    await current.app.evaluate((_electron, bytes) => {
      Object.assign(global, {
        xshotLeakCheck: Array.from({ length: 10 }, () =>
          Buffer.alloc(bytes, 1),
        ),
      });
    }, captureBytes);
    expect((await mainMemory()) - after).toBeGreaterThan(5 * captureBytes);
  });

  test('Windows: a real window is captured at its native size', async () => {
    test.skip(process.platform !== 'win32', 'Needs real window capture');
    packaged = await launchPackagedApp(PREFERENCES);
    const current = packaged;
    const target = await current.app.evaluate(
      async ({ BrowserWindow, desktopCapturer }) => {
        const win = new BrowserWindow({
          width: 640,
          height: 480,
          useContentSize: true,
          title: 'xshot-native-size',
          backgroundColor: '#3366cc',
        });
        await win.loadURL(
          'data:text/html,<title>xshot-native-size</title><body style="background:%233366cc"></body>',
        );
        const sources = await desktopCapturer.getSources({
          types: ['window'],
          thumbnailSize: { width: 0, height: 0 },
        });
        const source = sources.find((s) => s.name === 'xshot-native-size');
        return {
          sourceId: source?.id ?? '',
          content: win.getContentBounds(),
          outer: win.getBounds(),
        };
      },
    );
    expect(target.sourceId).not.toBe('');

    const [overlay] = await openOverlays(current);
    const startedAt = Date.now();
    const sessionId = await captureWindowFromOverlay(
      current,
      overlay,
      target.sourceId,
    );
    const scale = await primaryScale(current);
    const shown = await shownCaptureSize(current.window, sessionId);
    report('window-capture', {
      target,
      shown,
      msToEditor: Date.now() - startedAt,
    });
    // The frame width is the content width; the height adds the title bar.
    expect(shown.width).toBe(Math.round(target.content.width * scale));
    expect(shown.height).toBeGreaterThanOrEqual(
      Math.round(target.content.height * scale),
    );
    expect(shown.height).toBeLessThanOrEqual(
      Math.round(target.outer.height * scale),
    );
  });

  test('Linux: a selected region comes out at selection x scale', async () => {
    test.skip(process.platform !== 'linux', 'Real capture runs under Xvfb');
    packaged = await launchPackagedApp(PREFERENCES);
    const current = packaged;
    const before = await shownSessionId(current.window);
    const [overlay] = await openOverlays(current);
    await expect
      .poll(() =>
        overlayBackground(overlay).evaluate(
          (img: HTMLImageElement) => img.naturalWidth,
        ),
      )
      .toBeGreaterThan(0);

    const selection = { x: 100, y: 120, width: 320, height: 240 };
    await overlay.mouse.move(selection.x, selection.y);
    await overlay.mouse.down();
    await overlay.mouse.move(
      selection.x + selection.width,
      selection.y + selection.height,
      { steps: 10 },
    );
    await overlay.mouse.up();
    await overlay.getByRole('button', { name: '✓ Capture' }).click();

    await expect.poll(() => shownSessionId(current.window)).not.toBe(before);
    const sessionId = (await shownSessionId(current.window)) as string;
    const scale = await primaryScale(current);
    expect(await shownCaptureSize(current.window, sessionId)).toEqual({
      width: Math.round(selection.width * scale),
      height: Math.round(selection.height * scale),
    });
  });
});
