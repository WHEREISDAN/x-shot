import path from 'path';
import { expect, test, type Locator } from '@playwright/test';
import type { PiiDetectors, ScreenshotResult } from '../src/shared/ipc-types';
import {
  deliverScreenshot,
  editorFor,
  launchPackagedApp,
  pngDataUrl,
  type PackagedApp,
} from './packaged-app';

const FIXTURE_PATH = path.join(__dirname, 'fixtures', 'ocr-pii.png');
const FIXTURE_SIZE = { width: 1000, height: 420 };
// Top edge (image pixels) of the blur mask over the fixture's email, phone
// and IPv4 lines.
const PII_MASK_TOPS = [118, 198, 278];
const MASK_TOP_TOLERANCE = 12;
const OCR_FAILURE = 'OCR recognition failed';
const OCR_TIMEOUT_MS = 120_000;

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

async function waitForPiiMaskTops(
  packaged: PackagedApp,
  editor: Locator,
  count: number,
  deadline: number,
): Promise<number[]> {
  const output = packaged.logs.join('');
  const failureAt = output.indexOf(OCR_FAILURE);
  if (failureAt >= 0) {
    throw new Error(
      `OCR failed in the packaged build:\n${output.slice(failureAt, failureAt + 600)}`,
    );
  }

  const tops = await editor
    .locator('svg foreignObject')
    .evaluateAll((nodes) =>
      nodes.map((node) => Number(node.getAttribute('y'))),
    );
  if (tops.length >= count) return tops;
  if (Date.now() > deadline) {
    throw new Error(
      `Timed out waiting for ${count} PII masks; found ${tops.length}`,
    );
  }

  await packaged.window.waitForTimeout(500);
  return waitForPiiMaskTops(packaged, editor, count, deadline);
}

async function expectFixtureMasked(
  packaged: PackagedApp,
  screenshot: ScreenshotResult,
): Promise<void> {
  const maskTops = await waitForPiiMaskTops(
    packaged,
    editorFor(packaged.window, screenshot),
    PII_MASK_TOPS.length,
    Date.now() + OCR_TIMEOUT_MS,
  );

  PII_MASK_TOPS.forEach((expectedTop) => {
    expect(
      maskTops.some((top) => Math.abs(top - expectedTop) <= MASK_TOP_TOLERANCE),
      `expected a mask near y=${expectedTop}; masks at ${maskTops.join(', ')}`,
    ).toBe(true);
  });
  expect(packaged.logs.join('')).not.toContain(OCR_FAILURE);
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

  test('runs OCR again for a pixel-identical capture', async () => {
    const first = fixtureCapture('smoke-ocr-first');
    await deliverScreenshot(packaged, first);
    await expectFixtureMasked(packaged, first);

    const repeat = fixtureCapture('smoke-ocr-repeat');
    await deliverScreenshot(packaged, repeat);
    await expectFixtureMasked(packaged, repeat);
  });
});
