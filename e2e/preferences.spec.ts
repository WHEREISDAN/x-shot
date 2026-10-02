import fs from 'fs';
import os from 'os';
import path from 'path';
import { expect, test, type Page } from '@playwright/test';
import type { AppPreferences } from '../src/shared/ipc-types';
import {
  deliverScreenshot,
  launchPackagedApp,
  pngDataUrl,
  recordCopies,
  recordedCopies,
  type FixtureCapture,
  type PackagedApp,
  type SeedPreferences,
} from './packaged-app';
import { ipcRecords, spyOnIpc } from './ipc-spy';

const FIXTURE_PATH = path.join(__dirname, 'fixtures', 'ocr-pii.png');
// A bundled background of about 5 MB, uploaded as a user image.
const BACKGROUND_FILE = path.join(
  __dirname,
  '..',
  'assets',
  'backgrounds',
  '8.png',
);
const BACKGROUND_URL = /^xshot-asset:\/\/background\/[0-9a-f-]{36}\.png$/;

const SEED: SeedPreferences = {
  system: { launchAtStartup: false, showInTray: false },
  pii: { autoDetect: false },
};

const fixture = (sessionId: string): FixtureCapture => ({
  fixtureDataUrl: pngDataUrl(FIXTURE_PATH),
  width: 1000,
  height: 420,
  sessionId,
});

/** The background image URL the editor stage is drawn with, if any. */
async function stageBackgroundUrl(page: Page): Promise<string | null> {
  return page.evaluate(() => {
    const backgrounds = Array.from(
      document.querySelectorAll<HTMLElement>('[data-session-id] *'),
      (element) => element.style.backgroundImage,
    );
    const found = backgrounds.find((value) => value.includes('xshot-asset'));
    return found?.match(/url\("?([^")]+)"?\)/)?.[1] ?? null;
  });
}

/** The size an image URL decodes to in the editor page. */
async function decodedSize(page: Page, url: string) {
  return page.evaluate(async (src) => {
    const image = new Image();
    image.src = src;
    await image.decode();
    return { width: image.naturalWidth, height: image.naturalHeight };
  }, url);
}

async function mainPreferences({ window: page }: PackagedApp) {
  return page.evaluate(
    () =>
      window.electron.ipcRenderer.invoke(
        'get-preferences',
        {},
      ) as Promise<AppPreferences>,
  );
}

const exportScale = (page: Page) =>
  page.getByRole('combobox', { name: 'Export scale' });

test.describe('preferences persistence', () => {
  let packaged: PackagedApp | undefined;
  let dir: string;

  test.beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'xshot-prefs-'));
  });

  test.afterEach(async () => {
    await packaged?.close();
    packaged = undefined;
    fs.rmSync(dir, { recursive: true, force: true });
  });

  test('a 5 MB background survives a restart, with no data URL', async () => {
    packaged = await launchPackagedApp(SEED, { userDataDir: dir });
    await spyOnIpc(packaged);
    await deliverScreenshot(packaged, fixture('background-1'));

    await packaged.window
      .locator('input[type="file"][accept="image/*"]')
      .setInputFiles(BACKGROUND_FILE);
    const current = packaged;
    await expect
      .poll(() => stageBackgroundUrl(current.window))
      .toMatch(BACKGROUND_URL);
    const url = (await stageBackgroundUrl(current.window)) as string;
    const size = await decodedSize(current.window, url);
    expect(size.width).toBeGreaterThan(0);

    // On disk: the image as a file, the preferences naming only its id.
    const id = url.split('/').pop() as string;
    await expect
      .poll(() => fs.readFileSync(path.join(dir, 'preferences.json'), 'utf-8'))
      .toContain(id);
    const stored = fs.readFileSync(path.join(dir, 'preferences.json'), 'utf-8');
    expect(JSON.parse(stored).presentation.backgroundImage).toEqual({
      kind: 'file',
      id,
    });
    expect(stored).not.toContain('data:');
    expect(fs.readFileSync(path.join(dir, 'backgrounds', id))).toEqual(
      fs.readFileSync(BACKGROUND_FILE),
    );

    const records = await ipcRecords(current);
    const seen = (direction: string, channel: string) =>
      records.some((r) => r.direction === direction && r.channel === channel);
    expect(seen('invoke', 'import-background-image')).toBe(true);
    expect(seen('invoke', 'set-preferences')).toBe(true);
    expect(seen('reply', 'set-preferences')).toBe(true);
    expect(seen('reply', 'get-preferences')).toBe(true);
    expect(records.filter((r) => r.hasDataUrl)).toEqual([]);

    await packaged.close();
    packaged = await launchPackagedApp(null, { userDataDir: dir });
    await deliverScreenshot(packaged, fixture('background-2'));
    const restarted = packaged;
    await expect.poll(() => stageBackgroundUrl(restarted.window)).toBe(url);
    expect(await decodedSize(restarted.window, url)).toEqual(size);

    // The export draws it too: without it the padding would be transparent.
    await recordCopies(restarted);
    await restarted.window
      .getByRole('button', { name: 'Copy', exact: true })
      .click();
    await expect
      .poll(async () => (await recordedCopies(restarted)).length)
      .toBe(1);
    const [copied] = await recordedCopies(restarted);
    const paddingAlpha = await restarted.app.evaluate(
      ({ nativeImage }, dataUrl) => {
        const image = nativeImage.createFromDataURL(dataUrl);
        const { width } = image.getSize();
        // Top edge, middle: inside the padding the background fills.
        return image.toBitmap()[(2 * width + Math.floor(width / 2)) * 4 + 3];
      },
      copied,
    );
    expect(paddingAlpha).toBe(255);
  });

  test('an old data-URL background and export scale migrate on start', async () => {
    const legacyBackground = pngDataUrl(FIXTURE_PATH);
    fs.writeFileSync(
      path.join(dir, 'preferences.json'),
      JSON.stringify({
        ...SEED,
        export: { filenamePattern: 'X-Shot_$TIMESTAMP', autoSave: false },
        presentation: {
          backgroundImageUrl: legacyBackground,
          padding: 48,
          inset: 16,
          exportScale: 3,
        },
      }),
    );
    packaged = await launchPackagedApp(null, { userDataDir: dir });
    await deliverScreenshot(packaged, fixture('migrated'));
    const current = packaged;
    await expect
      .poll(() => stageBackgroundUrl(current.window))
      .toMatch(BACKGROUND_URL);
    const url = (await stageBackgroundUrl(current.window)) as string;
    expect(await decodedSize(current.window, url)).toEqual({
      width: 1000,
      height: 420,
    });
    await expect(exportScale(current.window)).toHaveValue('3');

    const stored = JSON.parse(
      fs.readFileSync(path.join(dir, 'preferences.json'), 'utf-8'),
    );
    expect(stored.export.defaultScale).toBe(3);
    expect(stored.presentation).not.toHaveProperty('exportScale');
    expect(stored.presentation).not.toHaveProperty('backgroundImageUrl');
    expect(JSON.stringify(stored)).not.toContain('data:');
  });

  test('the default export scale from Preferences starts every capture', async () => {
    packaged = await launchPackagedApp({
      ...SEED,
      capture: { defaultSaveLocation: dir },
      export: { autoSave: true, filenamePattern: 'export' },
    });
    const current = packaged;
    const page = current.window;
    await page.evaluate(() =>
      window.electron.ipcRenderer.invoke('open-preferences-window', undefined),
    );
    const isPreferences = (candidate: Page) =>
      candidate.url().includes('#/preferences');
    await expect
      .poll(() => current.app.windows().some(isPreferences))
      .toBe(true);
    const preferencesPage = current.app.windows().find(isPreferences) as Page;
    await preferencesPage.getByRole('tab', { name: /Export/ }).click();
    await preferencesPage
      .getByRole('combobox', { name: 'Default Export Scale' })
      .selectOption('2');
    await expect
      .poll(async () => (await mainPreferences(current)).export.defaultScale)
      .toBe(2);

    await deliverScreenshot(current, fixture('scale-1'));
    await expect(exportScale(page)).toHaveValue('2');

    // The panel's scale is this capture's only; it is never saved back.
    await exportScale(page).selectOption('1');
    await deliverScreenshot(current, fixture('scale-2'));
    await expect(exportScale(page)).toHaveValue('2');
    const saved = await mainPreferences(current);
    expect(saved.export.defaultScale).toBe(2);
    expect(saved.presentation).not.toHaveProperty('exportScale');

    // And the export really is at that scale.
    const twoX = path.join(dir, 'export.png');
    const oneX = path.join(dir, 'export (2).png');
    await page.getByRole('button', { name: 'Save', exact: true }).click();
    await expect(page.getByRole('status')).toContainText(`Saved to ${twoX}`);
    await exportScale(page).selectOption('1');
    await page.getByRole('button', { name: 'Save', exact: true }).click();
    await expect(page.getByRole('status')).toContainText(`Saved to ${oneX}`);
    const sizes = await current.app.evaluate(
      ({ nativeImage }, files) =>
        files.map((file) => nativeImage.createFromPath(file).getSize()),
      [twoX, oneX],
    );
    expect(sizes[0]).toEqual({
      width: sizes[1].width * 2,
      height: sizes[1].height * 2,
    });
  });
});
