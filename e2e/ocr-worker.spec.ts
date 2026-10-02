import path from 'path';
import { expect, test, type Page } from '@playwright/test';
import type { PiiDetectors } from '../src/shared/ipc-types';
import {
  countLogMarker,
  deliverScreenshot,
  editorFor,
  launchPackagedApp,
  pngDataUrl,
  readPiiMasks,
  waitForPiiMasks,
  type PackagedApp,
  type FixtureCapture,
} from './packaged-app';
import { selectTool } from './editor-actions';

const FIXTURES = path.join(__dirname, 'fixtures');
// Logged by the renderer each time it starts a tesseract worker.
const WORKER_CREATED = 'ocr-worker-created';

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

function fixtureCapture(
  file: string,
  size: { width: number; height: number },
  sessionId: string,
): FixtureCapture {
  return {
    fixtureDataUrl: pngDataUrl(path.join(FIXTURES, file)),
    ...size,
    sessionId,
  };
}

const SMALL = { width: 1000, height: 420 };
const SCREEN = { width: 1920, height: 1080 };

// tesseract.js caches language data in this IndexedDB store; older versions
// used LEGACY_KEY.
const LEGACY_KEY = './eng.traineddata';

function cacheKeys(page: Page): Promise<string[]> {
  return page.evaluate(
    () =>
      new Promise<string[]>((resolve, reject) => {
        const request = indexedDB.open('keyval-store');
        request.onupgradeneeded = () =>
          request.result.createObjectStore('keyval');
        request.onerror = () => reject(request.error);
        request.onsuccess = () => {
          const db = request.result;
          const keys = db
            .transaction('keyval', 'readonly')
            .objectStore('keyval')
            .getAllKeys();
          keys.onsuccess = () => {
            db.close();
            resolve(keys.result.map(String));
          };
          keys.onerror = () => reject(keys.error);
        };
      }),
  );
}

function seedLegacyCache(page: Page): Promise<void> {
  return page.evaluate(
    (key) =>
      new Promise<void>((resolve, reject) => {
        const request = indexedDB.open('keyval-store');
        request.onupgradeneeded = () =>
          request.result.createObjectStore('keyval');
        request.onerror = () => reject(request.error);
        request.onsuccess = () => {
          const db = request.result;
          const transaction = db.transaction('keyval', 'readwrite');
          transaction.objectStore('keyval').put(new Uint8Array(16), key);
          transaction.oncomplete = () => {
            db.close();
            resolve();
          };
          transaction.onerror = () => reject(transaction.error);
        };
      }),
    LEGACY_KEY,
  );
}

test.describe('shared OCR worker', () => {
  let packaged: PackagedApp | undefined;

  test.afterEach(async () => {
    await packaged?.close();
    packaged = undefined;
  });

  test('one worker serves three captures', async () => {
    packaged = await launchPackagedApp({
      system: { launchAtStartup: false, showInTray: false },
      pii: { autoDetect: true, defaultStyle: 'blur', detectors: DETECTORS },
    });
    const page = packaged.window;
    const first = fixtureCapture('ocr-pii.png', SMALL, 'worker-1');
    const second = fixtureCapture('ocr-pii-b.png', SMALL, 'worker-2');
    const third = fixtureCapture('ocr-pii-screen.png', SCREEN, 'worker-3');

    await deliverScreenshot(packaged, first);
    await waitForPiiMasks(packaged, editorFor(page, first), 3);
    await deliverScreenshot(packaged, second);
    await waitForPiiMasks(packaged, editorFor(page, second), 1);
    await deliverScreenshot(packaged, third);
    await waitForPiiMasks(packaged, editorFor(page, third), 6);

    expect(countLogMarker(packaged, WORKER_CREATED)).toBe(1);
  });

  test('no worker starts until Censor PII or the text tool needs OCR', async () => {
    packaged = await launchPackagedApp({
      system: { launchAtStartup: false, showInTray: false },
      pii: { autoDetect: false, defaultStyle: 'blur', detectors: DETECTORS },
    });
    const page = packaged.window;
    const capture = fixtureCapture('ocr-pii.png', SMALL, 'worker-idle');
    await deliverScreenshot(packaged, capture);
    await page.waitForTimeout(3_000);

    expect(countLogMarker(packaged, WORKER_CREATED)).toBe(0);
    expect(await readPiiMasks(editorFor(page, capture))).toHaveLength(0);

    // The text-select tool shows OCR word boxes, so it starts the worker.
    await selectTool(page, 'Text Highlight');
    const current = packaged;
    await expect
      .poll(() => countLogMarker(current, WORKER_CREATED), { timeout: 60_000 })
      .toBe(1);
    await expect(
      editorFor(page, capture).locator('rect[stroke-dasharray="4 2"]').first(),
    ).toBeVisible({ timeout: 60_000 });
  });
  test('removes language data cached by older versions', async () => {
    packaged = await launchPackagedApp({
      system: { launchAtStartup: false, showInTray: false },
      pii: { autoDetect: true, defaultStyle: 'blur', detectors: DETECTORS },
    });
    const page = packaged.window;
    await seedLegacyCache(page);
    expect(await cacheKeys(page)).toContain(LEGACY_KEY);

    const capture = fixtureCapture('ocr-pii.png', SMALL, 'worker-cache');
    await deliverScreenshot(packaged, capture);
    await waitForPiiMasks(packaged, editorFor(page, capture), 3);

    await expect.poll(() => cacheKeys(page)).not.toContain(LEGACY_KEY);
    expect(await cacheKeys(page)).toContainEqual(
      expect.stringMatching(/^tesseract-eng-[^/]+\/eng\.traineddata$/),
    );
  });
});
