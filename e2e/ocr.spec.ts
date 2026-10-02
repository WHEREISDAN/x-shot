import path from 'path';
import { expect, test } from '@playwright/test';
import type { PiiDetectors, ScreenshotResult } from '../src/shared/ipc-types';
import {
  deliverScreenshot,
  editorFor,
  hasOcrFailure,
  launchPackagedApp,
  pngDataUrl,
  waitForPiiMasks,
  type PackagedApp,
} from './packaged-app';

const FIXTURE_PATH = path.join(__dirname, 'fixtures', 'ocr-pii.png');
// 1920x1080 with 14 px UI text: two emails and two phone numbers, plus one
// 20 px email and phone near y=400.
const SCREEN_FIXTURE_PATH = path.join(
  __dirname,
  'fixtures',
  'ocr-pii-screen.png',
);
const SCREEN_FIXTURE_MASKS = 6;
const SCREEN_FIXTURE_LARGE_ROW_Y = 300;
const FIXTURE_SIZE = { width: 1000, height: 420 };
// Top edge (image pixels) of the rendered blur mask over the fixture's
// email, phone and IPv4 lines.
const PII_MASK_TOPS = [118, 198, 278];
const MASK_TOP_TOLERANCE = 12;

const DETECTORS: PiiDetectors = {
  email: true,
  phone: true,
  address: false,
  ipv4: true,
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

function fixtureCapture(sessionId: string): ScreenshotResult {
  return {
    imageDataUrl: pngDataUrl(FIXTURE_PATH),
    ...FIXTURE_SIZE,
    x: 0,
    y: 0,
    sourceId: 'smoke-fixture',
    sessionId,
  };
}

async function expectFixtureMasked(
  packaged: PackagedApp,
  screenshot: ScreenshotResult,
): Promise<void> {
  const masks = await waitForPiiMasks(
    packaged,
    editorFor(packaged.window, screenshot),
    PII_MASK_TOPS.length,
  );
  const maskTops = masks.map((mask) => mask.y);

  PII_MASK_TOPS.forEach((expectedTop) => {
    expect(
      maskTops.some((top) => Math.abs(top - expectedTop) <= MASK_TOP_TOLERANCE),
      `expected a mask near y=${expectedTop}; masks at ${maskTops.join(', ')}`,
    ).toBe(true);
  });
  expect(hasOcrFailure(packaged)).toBe(false);
}

test.describe('packaged OCR and PII masking', () => {
  let packaged: PackagedApp;

  test.beforeEach(async () => {
    packaged = await launchPackagedApp({
      system: { launchAtStartup: false, showInTray: false },
      pii: { autoDetect: true, defaultStyle: 'blur', detectors: DETECTORS },
    });
  });

  test.afterEach(async () => {
    await packaged?.close();
  });

  test('masks the email, phone number and IP address in a capture', async () => {
    const capture = fixtureCapture('smoke-ocr');
    await deliverScreenshot(packaged, capture);
    await expectFixtureMasked(packaged, capture);
  });

  test('masks small UI text in a full-resolution 1920x1080 capture', async () => {
    const capture: ScreenshotResult = {
      imageDataUrl: pngDataUrl(SCREEN_FIXTURE_PATH),
      width: 1920,
      height: 1080,
      sessionId: 'smoke-ocr-screen',
    };
    await deliverScreenshot(packaged, capture);
    const masks = await waitForPiiMasks(
      packaged,
      editorFor(packaged.window, capture),
      SCREEN_FIXTURE_MASKS,
    );

    // Two 14 px emails and phones near the top, one 20 px pair lower down.
    const rows = (tag: string) =>
      masks
        .filter((mask) => mask.tag === tag)
        .map((mask) =>
          mask.y < SCREEN_FIXTURE_LARGE_ROW_Y ? 'small' : 'large',
        )
        .sort();
    expect(masks).toHaveLength(SCREEN_FIXTURE_MASKS);
    expect(rows('pii-email')).toEqual(['large', 'small', 'small']);
    expect(rows('pii-phone')).toEqual(['large', 'small', 'small']);
    expect(hasOcrFailure(packaged)).toBe(false);
  });

  test('runs OCR again for a pixel-identical capture', async () => {
    const first = fixtureCapture('smoke-ocr-first');
    await deliverScreenshot(packaged, first);
    await expectFixtureMasked(packaged, first);

    const repeat = fixtureCapture('smoke-ocr-repeat');
    await deliverScreenshot(packaged, repeat);
    await expectFixtureMasked(packaged, repeat);
  });
});
