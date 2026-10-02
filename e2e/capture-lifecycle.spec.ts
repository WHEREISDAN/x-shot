import path from 'path';
import { expect, test, type Page } from '@playwright/test';
import type { PiiDetectors, ScreenshotResult } from '../src/shared/ipc-types';
import {
  deliverScreenshot,
  editorFor,
  launchPackagedApp,
  pngDataUrl,
  triggerFailedCapture,
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

async function shownImageSource(
  page: Page,
  screenshot: ScreenshotResult,
): Promise<string | null> {
  return editorFor(page, screenshot)
    .getByAltText('Screenshot')
    .getAttribute('src');
}

/** Builds a second, different capture by resizing the first in main. */
async function resizedCapture(
  { app }: PackagedApp,
  source: ScreenshotResult,
  width: number,
  sessionId: string,
): Promise<ScreenshotResult> {
  const resized = await app.evaluate(
    ({ nativeImage }, input) => {
      const image = nativeImage
        .createFromDataURL(input.dataUrl)
        .resize({ width: input.width });
      return { dataUrl: image.toDataURL(), size: image.getSize() };
    },
    { dataUrl: source.imageDataUrl, width },
  );
  return {
    imageDataUrl: resized.dataUrl,
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
    const imageA: ScreenshotResult = {
      imageDataUrl: pngDataUrl(FIXTURE_PATH),
      width: 1000,
      height: 420,
      sessionId: 'lifecycle-a',
    };
    await deliverScreenshot(packaged, imageA);

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
      (await shownImageSource(page, imageA)) === imageA.imageDataUrl,
      'editor still shows image A after the failed capture',
    ).toBe(true);
    await expect(stageEllipses(page, imageA)).toHaveCount(1);

    const imageB = await resizedCapture(packaged, imageA, 600, 'lifecycle-b');
    await deliverScreenshot(packaged, imageB);

    await expect(editorFor(page, imageA)).toHaveCount(0);
    expect(
      (await shownImageSource(page, imageB)) === imageB.imageDataUrl,
      'editor shows image B',
    ).toBe(true);
    await expect(stageEllipses(page, imageB)).toHaveCount(0);
    await expect(page.getByRole('alert')).toHaveCount(0);

    // The undo history from image A must not carry over.
    await page.keyboard.press(UNDO);
    await expect(stageEllipses(page, imageB)).toHaveCount(0);
  });
});
