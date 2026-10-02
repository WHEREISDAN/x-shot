import path from 'path';
import { expect, test, type Page } from '@playwright/test';
import type { PiiDetectors, ScreenshotResult } from '../src/shared/ipc-types';
import { captureAssetUrl } from '../src/shared/capture-asset';
import {
  deliverScreenshot,
  editorFor,
  launchPackagedApp,
  pngDataUrl,
  triggerFailedCapture,
  type FixtureCapture,
  type PackagedApp,
} from './packaged-app';
import { REDO, UNDO, drawEllipse, stageEllipses } from './editor-actions';

const FIXTURE_PATH = path.join(__dirname, 'fixtures', 'ocr-pii.png');

const NO_DETECTORS: PiiDetectors = {
  email: false,
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

/** Whether the editor shows the stored capture `screenshot` names. */
async function showsCapture(
  page: Page,
  screenshot: ScreenshotResult,
): Promise<boolean> {
  const src = await editorFor(page, screenshot)
    .getByAltText('Screenshot')
    .getAttribute('src');
  return src === captureAssetUrl(screenshot.assetId);
}

/** Builds a second, different capture by resizing the first in main. */
async function resizedCapture(
  { app }: PackagedApp,
  source: FixtureCapture,
  width: number,
  sessionId: string,
): Promise<FixtureCapture> {
  const resized = await app.evaluate(
    ({ nativeImage }, input) => {
      const image = nativeImage
        .createFromDataURL(input.dataUrl)
        .resize({ width: input.width });
      return { dataUrl: image.toDataURL(), size: image.getSize() };
    },
    { dataUrl: source.fixtureDataUrl, width },
  );
  return {
    fixtureDataUrl: resized.dataUrl,
    width: resized.size.width,
    height: resized.size.height,
    sessionId,
  };
}

test.describe('capture result and editor lifecycle', () => {
  let packaged: PackagedApp;

  test.beforeEach(async () => {
    packaged = await launchPackagedApp({
      system: { launchAtStartup: false, showInTray: false },
      pii: {
        autoDetect: false,
        defaultStyle: 'black',
        detectors: NO_DETECTORS,
      },
    });
  });

  test.afterEach(async () => {
    await packaged?.close();
  });

  test('a failed capture keeps the edit; the next capture replaces it', async () => {
    const page = packaged.window;
    const imageA: FixtureCapture = {
      fixtureDataUrl: pngDataUrl(FIXTURE_PATH),
      width: 1000,
      height: 420,
      sessionId: 'lifecycle-a',
    };
    const deliveredA = await deliverScreenshot(packaged, imageA);

    await drawEllipse(page, imageA);
    await expect(stageEllipses(page, imageA)).toHaveCount(1);
    // Prove the undo shortcut works here, so the check after the next
    // capture is meaningful.
    await page.keyboard.press(UNDO);
    await expect(stageEllipses(page, imageA)).toHaveCount(0);
    await page.keyboard.press(REDO);
    await expect(stageEllipses(page, imageA)).toHaveCount(1);

    await triggerFailedCapture(packaged);

    await expect(page.getByRole('alert')).toBeVisible();
    await expect(editorFor(page, imageA)).toBeVisible();
    expect(
      await showsCapture(page, deliveredA),
      'editor still shows image A after the failed capture',
    ).toBe(true);
    await expect(stageEllipses(page, imageA)).toHaveCount(1);

    const imageB = await resizedCapture(packaged, imageA, 600, 'lifecycle-b');
    const deliveredB = await deliverScreenshot(packaged, imageB);

    await expect(editorFor(page, imageA)).toHaveCount(0);
    expect(await showsCapture(page, deliveredB), 'editor shows image B').toBe(
      true,
    );
    await expect(stageEllipses(page, imageB)).toHaveCount(0);
    await expect(page.getByRole('alert')).toHaveCount(0);

    // The undo history from image A must not carry over.
    await page.keyboard.press(UNDO);
    await expect(stageEllipses(page, imageB)).toHaveCount(0);
  });
});
