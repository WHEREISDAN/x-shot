import fs from 'fs';
import os from 'os';
import path from 'path';
import { expect, test, type Page } from '@playwright/test';
import type { PiiDetectors, ScreenshotResult } from '../src/shared/ipc-types';
import {
  deliverScreenshot,
  editorFor,
  launchPackagedApp,
  meanBrightness,
  pngDataUrl,
  recordCopies,
  waitForPiiMasks,
  type PackagedApp,
  type SeedPreferences,
} from './packaged-app';
import { editorToolbar } from './editor-actions';

const FIXTURE: ScreenshotResult = {
  imageDataUrl: pngDataUrl(path.join(__dirname, 'fixtures', 'ocr-pii.png')),
  width: 1000,
  height: 420,
  sessionId: 'export',
};
// Inside the email text of ocr-pii.png.
const EMAIL_REGION = { x: 165, y: 130, width: 300, height: 20 };
// Pixels sampled inward from each corner of an export.
const CORNER_OFFSETS = [
  [1, 1],
  [3, 3],
  [8, 2],
  [2, 8],
  [15, 15],
  [30, 10],
  [10, 30],
];
// Allowed per-channel difference after downscaling the 2x export.
const RESAMPLE_TOLERANCE = 40;

const EMAIL_ONLY: PiiDetectors = {
  email: true,
  phone: false,
  address: false,
  ipv4: false,
  url: false,
  ssn: false,
  creditCard: false,
  dob: false,
  postalUS: false,
  postalCA: false,
  postalUK: false,
  uuid: false,
  mac: false,
  iban: false,
  poBox: false,
  tokens: false,
};

function autosaveTo(dir: string, extra: SeedPreferences = {}): SeedPreferences {
  return {
    system: { launchAtStartup: false, showInTray: false },
    pii: { autoDetect: false },
    capture: { defaultSaveLocation: dir },
    export: { autoSave: true, filenamePattern: 'export' },
    ...extra,
  };
}

async function save(page: Page) {
  await page.getByRole('button', { name: 'Save', exact: true }).click();
}

async function setExportScale(page: Page, scale: number) {
  await page
    .locator('select', { has: page.locator('option', { hasText: /^2x$/ }) })
    .selectOption(String(scale));
}

type ImageSize = { width: number; height: number };

/** Largest channel difference between a 1x export and a downscaled 2x one. */
async function cornerDifference(
  { app }: PackagedApp,
  oneX: string,
  twoX: string,
): Promise<{ one: ImageSize; two: ImageSize; maxDiff: number }> {
  return app.evaluate(
    ({ nativeImage }, input) => {
      const one = nativeImage.createFromPath(input.oneX);
      const two = nativeImage.createFromPath(input.twoX);
      const size = one.getSize();
      const scaled = two.resize({
        width: size.width,
        height: size.height,
        quality: 'best',
      });
      const a = one.toBitmap();
      const b = scaled.toBitmap();
      const corners = [
        [0, 0, 1, 1],
        [size.width - 1, 0, -1, 1],
        [0, size.height - 1, 1, -1],
        [size.width - 1, size.height - 1, -1, -1],
      ];
      const diffs = corners.flatMap(([cx, cy, dx, dy]) =>
        input.offsets.map(([ox, oy]) => {
          const i = ((cy + dy * oy) * size.width + (cx + dx * ox)) * 4;
          return Math.max(
            ...[0, 1, 2, 3].map((c) => Math.abs(a[i + c] - b[i + c])),
          );
        }),
      );
      return { one: size, two: two.getSize(), maxDiff: Math.max(...diffs) };
    },
    { oneX, twoX, offsets: CORNER_OFFSETS },
  );
}

test.describe('export', () => {
  let packaged: PackagedApp | undefined;
  let dir: string;

  test.beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'xshot-export-'));
  });

  test.afterEach(async () => {
    await packaged?.close();
    packaged = undefined;
    fs.rmSync(dir, { recursive: true, force: true });
  });

  test('autosaves 1x and 2x presentation exports without overwriting', async () => {
    packaged = await launchPackagedApp(autosaveTo(dir));
    const page = packaged.window;
    await deliverScreenshot(packaged, FIXTURE);
    const oneX = path.join(dir, 'export.png');
    const twoX = path.join(dir, 'export (2).png');

    await save(page);
    await expect(page.getByRole('status')).toContainText(`Saved to ${oneX}`);
    await setExportScale(page, 2);
    await save(page);
    await expect(page.getByRole('status')).toContainText(`Saved to ${twoX}`);

    const { one, two, maxDiff } = await cornerDifference(packaged, oneX, twoX);
    expect(two).toEqual({ width: one.width * 2, height: one.height * 2 });
    expect(maxDiff).toBeLessThan(RESAMPLE_TOLERANCE);
  });

  test('autosave creates a missing folder', async () => {
    const nested = path.join(dir, 'new', 'nested');
    packaged = await launchPackagedApp(
      autosaveTo(dir, { capture: { defaultSaveLocation: nested } }),
    );
    await deliverScreenshot(packaged, FIXTURE);

    await save(packaged.window);
    await expect(packaged.window.getByRole('status')).toContainText('Saved');
    expect(fs.existsSync(path.join(nested, 'export.png'))).toBe(true);
  });

  test('a failed save is reported and the editor keeps working', async () => {
    // A file where a folder should be makes every platform refuse the save.
    const blocker = path.join(dir, 'not-a-folder');
    fs.writeFileSync(blocker, 'x');
    packaged = await launchPackagedApp(
      autosaveTo(dir, {
        capture: { defaultSaveLocation: path.join(blocker, 'shots') },
      }),
    );
    const page = packaged.window;
    await recordCopies(packaged);
    await deliverScreenshot(packaged, FIXTURE);

    await save(page);
    const alert = page.getByRole('alert');
    await expect(alert).toContainText("Couldn't save the screenshot");
    await page.waitForTimeout(2_500);
    await expect(alert).toBeVisible();

    await page.getByRole('button', { name: 'Dismiss' }).click();
    await page.getByRole('button', { name: 'Copy', exact: true }).click();
    await expect(page.getByRole('status')).toContainText(
      'Copied to the clipboard.',
    );
  });

  test('saved files carry the PII masks', async () => {
    packaged = await launchPackagedApp(
      autosaveTo(dir, {
        pii: { autoDetect: true, defaultStyle: 'blur', detectors: EMAIL_ONLY },
        presentation: { padding: 0, inset: 0 },
      }),
    );
    const page = packaged.window;
    await deliverScreenshot(packaged, FIXTURE);
    await waitForPiiMasks(packaged, editorFor(page, FIXTURE), 1);

    await save(page);
    await expect(page.getByRole('status')).toContainText('Saved');
    const saved = pngDataUrl(path.join(dir, 'export.png'));
    const brightness = (dataUrl: string) =>
      meanBrightness(packaged as PackagedApp, dataUrl, EMAIL_REGION, 1000);

    expect(await brightness(FIXTURE.imageDataUrl)).toBeGreaterThan(120);
    expect(await brightness(saved)).toBeLessThan(40);
  });

  test('at 1024x600 the whole screenshot stays above the toolbar', async () => {
    packaged = await launchPackagedApp(autosaveTo(dir));
    await packaged.app.evaluate(({ BrowserWindow }) => {
      const main = BrowserWindow.getAllWindows().find(
        (win) => !win.webContents.getURL().includes('#/'),
      );
      main?.setSize(1024, 600);
    });
    const page = packaged.window;
    await deliverScreenshot(packaged, FIXTURE);
    await expect.poll(() => page.evaluate(() => window.innerHeight)).toBe(600);

    const image = editorFor(page, FIXTURE).getByAltText('Screenshot');
    await expect
      .poll(async () => {
        const shot = await image.boundingBox();
        const toolbar = await editorToolbar(page).boundingBox();
        if (!shot || !toolbar) return false;
        return (
          shot.y >= 0 &&
          shot.x >= 0 &&
          shot.x + shot.width <= 1024 &&
          shot.y + shot.height <= toolbar.y
        );
      })
      .toBe(true);
  });
});
