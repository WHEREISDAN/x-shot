import fs from 'fs';
import path from 'path';
import { expect, test, type Page } from '@playwright/test';
import type { PiiDetectors } from '../src/shared/ipc-types';
import { captureAssetUrl } from '../src/shared/capture-asset';
import {
  deliverScreenshot,
  editorFor,
  launchPackagedApp,
  pngDataUrl,
  storedAssetCount,
  waitForPiiMasks,
  type FixtureCapture,
  type PackagedApp,
} from './packaged-app';
import { ipcRecords, spyOnIpc } from './ipc-spy';

const FIXTURE_PATH = path.join(__dirname, 'fixtures', 'ocr-pii.png');
const SCREEN_FIXTURE_PATH = path.join(
  __dirname,
  'fixtures',
  'ocr-pii-screen.png',
);
const UNKNOWN_ID = '0b7c2d4e-1f3a-4b5c-8d6e-7f8091a2b3c4';

const EMAIL_AND_PHONE: PiiDetectors = {
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

const fixture = (sessionId: string): FixtureCapture => ({
  fixtureDataUrl: pngDataUrl(FIXTURE_PATH),
  width: 1000,
  height: 420,
  sessionId,
});

/** The status a renderer fetch of `url` gets, or the error it throws. */
async function fetchStatus(page: Page, url: string): Promise<number | string> {
  return page.evaluate(async (target) => {
    try {
      return (await fetch(target)).status;
    } catch (error) {
      return String(error);
    }
  }, url);
}

async function fetchBase64(page: Page, url: string): Promise<string> {
  return page.evaluate(async (target) => {
    const bytes = new Uint8Array(await (await fetch(target)).arrayBuffer());
    return btoa(Array.from(bytes, (b) => String.fromCharCode(b)).join(''));
  }, url);
}

test.describe('capture asset store and protocol', () => {
  let packaged: PackagedApp;

  test.afterEach(async () => {
    await packaged?.close();
  });

  test('serves a capture only by its id and frees replaced ones', async () => {
    packaged = await launchPackagedApp({
      system: { launchAtStartup: false, showInTray: false },
    });
    const page = packaged.window;
    const first = await deliverScreenshot(packaged, fixture('asset-1'));
    const firstUrl = captureAssetUrl(first.assetId);

    // The editor draws the capture from the protocol URL.
    const image = editorFor(page, first).getByAltText('Screenshot');
    await expect(image).toHaveAttribute('src', firstUrl);
    await expect
      .poll(() => image.evaluate((img: HTMLImageElement) => img.naturalWidth))
      .toBe(1000);
    expect(await fetchBase64(page, firstUrl)).toBe(
      fs.readFileSync(FIXTURE_PATH).toString('base64'),
    );

    expect(await fetchStatus(page, captureAssetUrl(UNKNOWN_ID))).toBe(404);
    expect(
      await fetchStatus(page, 'xshot-asset://capture/../../../etc/passwd'),
    ).toBe(404);
    expect(await fetchStatus(page, 'xshot-asset://capture/')).toBe(404);

    const second = await deliverScreenshot(packaged, fixture('asset-2'));
    expect(await fetchStatus(page, firstUrl)).toBe(404);
    expect(await fetchStatus(page, captureAssetUrl(second.assetId))).toBe(200);

    // Twenty more captures leave exactly one in memory.
    await Array.from({ length: 20 }, (_, i) => i).reduce(
      async (previous, i) => {
        await previous;
        await deliverScreenshot(packaged, fixture(`asset-loop-${i}`));
      },
      Promise.resolve(),
    );
    expect(await storedAssetCount(packaged)).toBe(1);

    // Deleting the capture in the editor frees it in main.
    await page.getByRole('button', { name: 'Delete', exact: true }).click();
    await expect.poll(() => storedAssetCount(packaged)).toBe(0);
  });

  test('no data: URL crosses IPC while a capture loads and is masked', async () => {
    packaged = await launchPackagedApp({
      system: { launchAtStartup: false, showInTray: false },
      pii: {
        autoDetect: true,
        defaultStyle: 'blur',
        detectors: EMAIL_AND_PHONE,
      },
    });
    await spyOnIpc(packaged);
    const capture: FixtureCapture = {
      fixtureDataUrl: pngDataUrl(SCREEN_FIXTURE_PATH),
      width: 1920,
      height: 1080,
      sessionId: 'asset-ipc',
    };
    await deliverScreenshot(packaged, capture);
    // OCR read the pixels through the protocol and masks were applied.
    await waitForPiiMasks(packaged, editorFor(packaged.window, capture), 6);

    const records = await ipcRecords(packaged);
    const channels = (direction: string) =>
      records.filter((r) => r.direction === direction).map((r) => r.channel);
    // The spy saw the capture arrive and the editor call main both ways.
    expect(channels('to-renderer')).toContain('capture-result');
    expect(channels('invoke')).toContain('get-preferences');
    expect(channels('send')).toContain('log');
    expect(records.filter((r) => r.hasDataUrl)).toEqual([]);

    // The spy does catch a data URL when one is sent.
    await packaged.window.evaluate(() =>
      window.electron.ipcRenderer.sendMessage('log', {
        level: 'info',
        message: 'spy check data:image/png;base64,AAAA',
      }),
    );
    await expect
      .poll(async () =>
        (await ipcRecords(packaged)).filter((r) => r.hasDataUrl),
      )
      .toEqual([{ direction: 'send', channel: 'log', hasDataUrl: true }]);
  });
});
