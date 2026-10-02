import fs from 'fs';
import os from 'os';
import path from 'path';
import {
  _electron as electron,
  expect,
  test,
  type ElectronApplication,
  type Locator,
  type Page,
} from '@playwright/test';
import webpackPaths from '../.erb/configs/webpack.paths';
import type {
  AppPreferences,
  CaptureResult,
  ScreenshotResult,
} from '../src/shared/ipc-types';
import type { E2eHooks } from '../src/main/e2e-hooks';

const PRODUCT_NAME = 'X-Shot';
const OCR_FAILURE = 'OCR recognition failed';

/** Main merges stored preferences one level deep, so sections may be partial. */
export interface SeedPreferences {
  capture?: Partial<AppPreferences['capture']>;
  editor?: Partial<AppPreferences['editor']>;
  export?: Partial<AppPreferences['export']>;
  system?: Partial<AppPreferences['system']>;
  pii?: Partial<AppPreferences['pii']>;
  presentation?: Partial<AppPreferences['presentation']>;
}

/** A capture made from a fixture PNG. */
export interface FixtureCapture {
  /** The fixture as a data URL; it is read by the test, never sent over IPC. */
  fixtureDataUrl: string;
  width: number;
  height: number;
  sessionId: string;
}

/** What the editor helpers need to find a capture's editor and stage. */
export type CaptureView = Pick<
  ScreenshotResult,
  'sessionId' | 'width' | 'height'
>;

export interface RenderedMask {
  tag: string;
  x: number;
  y: number;
}

export interface PackagedApp {
  app: ElectronApplication;
  window: Page;
  logs: string[];
  close: () => Promise<void>;
}

function executableIn(dir: string): string {
  if (process.platform === 'darwin') {
    return path.join(
      dir,
      `${PRODUCT_NAME}.app`,
      'Contents',
      'MacOS',
      PRODUCT_NAME,
    );
  }
  if (process.platform === 'win32') {
    return path.join(dir, `${PRODUCT_NAME}.exe`);
  }
  return path.join(dir, PRODUCT_NAME.toLowerCase());
}

export function findPackagedExecutable(
  root: string = webpackPaths.smokeBuildPath,
): string {
  const entries = fs.existsSync(root) ? fs.readdirSync(root) : [];
  const executable = entries
    .map((entry) => executableIn(path.join(root, entry)))
    .find((candidate) => fs.existsSync(candidate));
  if (!executable) {
    throw new Error(
      `No packaged app found in ${root}. Run "npm run build && npm run package:dir" first.`,
    );
  }
  return executable;
}

/**
 * Launches the packaged app against a throwaway profile seeded with the given
 * preferences, so the user's real preferences and caches are never touched.
 */
export interface LaunchOptions {
  args?: string[];
  /** Reuse this profile and keep it on close, e.g. to restart the app. */
  userDataDir?: string;
}

export async function launchPackagedApp(
  preferences: SeedPreferences | null,
  {
    args: extraArgs = [],
    userDataDir: existingUserDataDir,
  }: LaunchOptions = {},
): Promise<PackagedApp> {
  const userDataDir =
    existingUserDataDir ??
    fs.mkdtempSync(path.join(os.tmpdir(), 'xshot-smoke-'));
  if (preferences) {
    fs.writeFileSync(
      path.join(userDataDir, 'preferences.json'),
      JSON.stringify(preferences),
    );
  }

  const args = [`--user-data-dir=${userDataDir}`, ...extraArgs];
  // Unpacked Linux builds lack a SUID sandbox helper on CI runners.
  if (process.platform === 'linux') args.push('--no-sandbox');

  const app = await electron.launch({
    executablePath: findPackagedExecutable(),
    args,
    // Installs the hook that lets tests put fixture bytes into main's store.
    env: { ...process.env, XSHOT_E2E: '1' },
  });
  const logs: string[] = [];
  const collect = (chunk: Buffer) => logs.push(chunk.toString());
  app.process().stdout?.on('data', collect);
  app.process().stderr?.on('data', collect);

  const window = await app.firstWindow();
  window.on('console', (message) => logs.push(message.text()));

  return {
    app,
    window,
    logs,
    close: async () => {
      await app.close();
      if (!existingUserDataDir) {
        fs.rmSync(userDataDir, { recursive: true, force: true });
      }
    },
  };
}

export function pngDataUrl(filePath: string): string {
  return `data:image/png;base64,${fs.readFileSync(filePath).toString('base64')}`;
}

export function editorFor(
  page: Page,
  screenshot: Pick<CaptureView, 'sessionId'>,
) {
  return page.locator(`[data-session-id="${screenshot.sessionId}"]`);
}

async function sendCaptureResult(
  app: ElectronApplication,
  result: CaptureResult,
): Promise<void> {
  await app.evaluate(({ BrowserWindow }, payload) => {
    const editor = BrowserWindow.getAllWindows().find(
      (win) => !win.webContents.getURL().includes('#/'),
    );
    if (!editor) throw new Error('Main window not found');
    editor.webContents.send('capture-result', payload);
  }, result);
}

/**
 * Puts the fixture's bytes into main's capture store the way a delivery
 * does, releasing the capture it replaces.
 */
export async function storeFixture(
  { app }: PackagedApp,
  capture: FixtureCapture,
  scaleFactor = 1,
): Promise<ScreenshotResult> {
  const { fixtureDataUrl, sessionId } = capture;
  const stored = await app.evaluate(
    (_electron, input) => {
      const hooks = (global as unknown as { xshotE2E?: E2eHooks }).xshotE2E;
      if (!hooks) throw new Error('The app was launched without XSHOT_E2E=1');
      return hooks.addCapture(input);
    },
    {
      sessionId,
      pngBase64: fixtureDataUrl.slice(fixtureDataUrl.indexOf(',') + 1),
      scaleFactor,
    },
  );
  expect({ width: stored.width, height: stored.height }).toEqual({
    width: capture.width,
    height: capture.height,
  });
  return { ...stored, scaleFactor, sessionId };
}

/**
 * Delivers a successful capture through the same main-to-editor channel a
 * real capture uses. Retries until the editor shows this session, because the
 * renderer only subscribes after its first render.
 */
export async function deliverScreenshot(
  packaged: PackagedApp,
  capture: FixtureCapture,
): Promise<ScreenshotResult> {
  const { app, window: page } = packaged;
  const screenshot = await storeFixture(packaged, capture);
  await expect(async () => {
    await sendCaptureResult(app, { ok: true, screenshot });
    await expect(editorFor(page, screenshot)).toBeVisible({ timeout: 2_000 });
  }).toPass({ timeout: 20_000 });
  return screenshot;
}

/** How many captures main's store holds. */
export async function storedAssetCount({ app }: PackagedApp): Promise<number> {
  return app.evaluate(() => {
    const hooks = (global as unknown as { xshotE2E?: E2eHooks }).xshotE2E;
    if (!hooks) throw new Error('The app was launched without XSHOT_E2E=1');
    return hooks.assetCount();
  });
}

/**
 * Starts a real capture and confirms a window that does not exist, so main
 * reports a genuine failure through its capture-result path.
 */
/**
 * Makes main read the given macOS Screen Recording status. Test machines
 * and CI runners have no granted permission, and the real status cannot be
 * changed from a test.
 */
export async function stubScreenAccess(
  { app }: PackagedApp,
  status: 'granted' | 'denied',
): Promise<void> {
  await app.evaluate(({ systemPreferences }, value) => {
    Object.assign(systemPreferences, { getMediaAccessStatus: () => value });
  }, status);
}

export const isOverlayPage = (candidate: Page) =>
  candidate.url().includes('#/screenshot');

export function overlayPages({ app }: PackagedApp): Page[] {
  return app.windows().filter(isOverlayPage);
}

export async function displayCount({ app }: PackagedApp): Promise<number> {
  return app.evaluate(({ screen }) => screen.getAllDisplays().length);
}

/** Starts a capture the way a hotkey does and waits for every overlay. */
export async function openOverlays(packaged: PackagedApp): Promise<Page[]> {
  await packaged.window.evaluate(() =>
    window.electron.ipcRenderer.sendMessage('screenshot-capture', undefined),
  );
  const expected = await displayCount(packaged);
  await expect
    .poll(() => overlayPages(packaged).length, { timeout: 30_000 })
    .toBe(expected);
  const pages = overlayPages(packaged);
  await Promise.all(
    pages.map((page) => page.waitForLoadState('domcontentloaded')),
  );
  return pages;
}

export async function triggerFailedCapture(
  packaged: PackagedApp,
): Promise<void> {
  const { window: page } = packaged;
  await stubScreenAccess(packaged, 'granted');
  const [overlay] = await openOverlays(packaged);

  // The coordinator ignores a confirmation until the overlays are ready, so
  // resend until the editor reports the failure.
  const alert = page.getByRole('alert');
  await expect(async () => {
    if (!overlay.isClosed()) {
      await overlay
        .evaluate(() =>
          window.electron.ipcRenderer.sendMessage('screenshot-window', {
            sourceId: 'window:0:x-shot-missing',
          }),
        )
        .catch(() => {});
    }
    await expect(alert).toBeVisible({ timeout: 3_000 });
  }).toPass({ timeout: 30_000 });
}

export async function readPiiMasks(editor: Locator): Promise<RenderedMask[]> {
  return editor.locator('[data-pii-tag]').evaluateAll((nodes) =>
    nodes.map((node) => {
      const shape = node.firstElementChild;
      return {
        tag: node.getAttribute('data-pii-tag') ?? '',
        x: Number(shape?.getAttribute('x')),
        y: Number(shape?.getAttribute('y')),
      };
    }),
  );
}

/**
 * Polls until the editor shows at least `count` PII masks. Fails fast with
 * the renderer's error if OCR fails.
 */
export async function waitForPiiMasks(
  packaged: PackagedApp,
  editor: Locator,
  count: number,
  deadline: number = Date.now() + 120_000,
): Promise<RenderedMask[]> {
  const output = packaged.logs.join('');
  const failureAt = output.indexOf(OCR_FAILURE);
  if (failureAt >= 0) {
    throw new Error(
      `OCR failed in the packaged build:\n${output.slice(failureAt, failureAt + 600)}`,
    );
  }

  const masks = await readPiiMasks(editor);
  if (masks.length >= count) return masks;
  if (Date.now() > deadline) {
    throw new Error(
      `Timed out waiting for ${count} PII masks; found ${masks.length}`,
    );
  }

  await packaged.window.waitForTimeout(500);
  return waitForPiiMasks(packaged, editor, count, deadline);
}

export function hasOcrFailure(packaged: PackagedApp): boolean {
  return packaged.logs.join('').includes(OCR_FAILURE);
}

/** How many times the app logged `marker` so far. */
export function countLogMarker(packaged: PackagedApp, marker: string): number {
  return packaged.logs.join('').split(marker).length - 1;
}

/** Replaces main's clipboard handler so copies are recorded, not written. */
export async function recordCopies({ app }: PackagedApp): Promise<void> {
  await app.evaluate(({ ipcMain }) => {
    const store = global as unknown as { xshotCopies: string[] };
    store.xshotCopies = [];
    ipcMain.removeHandler('copy-image');
    // Kept as data URLs only on the test side, for the pixel checks.
    ipcMain.handle('copy-image', (_event, request: { png: Uint8Array }) => {
      const base64 = Buffer.from(request.png).toString('base64');
      store.xshotCopies.push(`data:image/png;base64,${base64}`);
      return { ok: true };
    });
  });
}

export async function recordedCopies({ app }: PackagedApp): Promise<string[]> {
  return app.evaluate(
    () => (global as unknown as { xshotCopies: string[] }).xshotCopies,
  );
}

/** Mean RGB brightness (0-255) of a region given in source-image pixels. */
export async function meanBrightness(
  { app }: PackagedApp,
  dataUrl: string,
  region: { x: number; y: number; width: number; height: number },
  sourceWidth: number,
): Promise<number> {
  return app.evaluate(
    ({ nativeImage }, input) => {
      const image = nativeImage.createFromDataURL(input.dataUrl);
      const { width } = image.getSize();
      const scale = width / input.sourceWidth;
      const bitmap = image.toBitmap();
      const x0 = Math.round(input.region.x * scale);
      const y0 = Math.round(input.region.y * scale);
      const x1 = Math.round((input.region.x + input.region.width) * scale);
      const y1 = Math.round((input.region.y + input.region.height) * scale);
      let total = 0;
      for (let y = y0; y < y1; y += 1) {
        for (let x = x0; x < x1; x += 1) {
          const i = (y * width + x) * 4;
          total += (bitmap[i] + bitmap[i + 1] + bitmap[i + 2]) / 3;
        }
      }
      return total / ((x1 - x0) * (y1 - y0));
    },
    { dataUrl, region, sourceWidth },
  );
}

/** Attaches a measurement to the test and prints it into the CI log. */
export function report(type: string, data: unknown): void {
  const description = JSON.stringify(data);
  test.info().annotations.push({ type, description });
  process.stdout.write(`${type} ${description}\n`);
}
