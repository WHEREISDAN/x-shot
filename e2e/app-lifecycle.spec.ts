import { spawn, type ChildProcess } from 'child_process';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { expect, test, type Page } from '@playwright/test';
import {
  findPackagedExecutable,
  launchPackagedApp,
  type PackagedApp,
  type SeedPreferences,
} from './packaged-app';
import { openedUrls, recordOpenedUrls } from './external-links';

const SEED: SeedPreferences = {
  system: { launchAtStartup: false, showInTray: false },
  pii: { autoDetect: false },
};

// Sliders and text fields wait this long before saving on their own.
const DEBOUNCE_MS = 300;

const isPreferencesPage = (page: Page) => page.url().includes('#/preferences');

async function openPreferences(packaged: PackagedApp): Promise<Page> {
  await packaged.window.evaluate(() =>
    window.electron.ipcRenderer.invoke('open-preferences-window', undefined),
  );
  await expect
    .poll(() => packaged.app.windows().some(isPreferencesPage))
    .toBe(true);
  const page = packaged.app.windows().find(isPreferencesPage) as Page;
  await page.waitForLoadState('domcontentloaded');
  return page;
}

async function filenamePatternField(preferences: Page) {
  await preferences.getByRole('tab', { name: /Export/ }).click();
  return preferences.getByRole('textbox', { name: 'Filename Pattern' });
}

/**
 * Types into Filename Pattern and, in the same main-process step, closes
 * Preferences or quits, the way a user does when they close right after
 * typing. Returns the most time that passed between the two, in ms.
 */
async function typeThen(
  { app }: PackagedApp,
  value: string,
  then: 'close' | 'quit',
): Promise<number> {
  return app.evaluate(
    async ({ app: electronApp, BrowserWindow }, input) => {
      const win = BrowserWindow.getAllWindows().find((candidate) =>
        candidate.webContents.getURL().includes('#/preferences'),
      );
      if (!win) throw new Error('Preferences window not found');
      const startedAt = Date.now();
      await win.webContents.executeJavaScript(`(() => {
        const field = document.querySelector(
          '[aria-labelledby="filename-pattern-label"]',
        );
        const setValue = Object.getOwnPropertyDescriptor(
          HTMLInputElement.prototype,
          'value',
        ).set;
        setValue.call(field, ${JSON.stringify(input.value)});
        field.dispatchEvent(new Event('input', { bubbles: true }));
      })()`);
      if (input.then === 'close') win.close();
      else setTimeout(() => electronApp.quit(), 0);
      return Date.now() - startedAt;
    },
    { value, then },
  );
}

const storedPattern = (dir: string): string | undefined => {
  const file = path.join(dir, 'preferences.json');
  if (!fs.existsSync(file)) return undefined;
  return JSON.parse(fs.readFileSync(file, 'utf-8')).export?.filenamePattern;
};

/** Which X-Shot windows are open, by route. */
async function openRoutes({ app }: PackagedApp) {
  return app.evaluate(({ BrowserWindow }) =>
    BrowserWindow.getAllWindows().map((win) =>
      win.webContents.getURL().includes('#/preferences')
        ? 'preferences'
        : 'editor',
    ),
  );
}

function launchSecondInstance(userDataDir: string): ChildProcess {
  const args = [`--user-data-dir=${userDataDir}`];
  if (process.platform === 'linux') args.push('--no-sandbox');
  return spawn(findPackagedExecutable(), args, {
    env: { ...process.env, XSHOT_E2E: '1' },
    stdio: 'ignore',
  });
}

/** The exit code, or 'running' if the process is still up after the wait. */
function exitCodeWithin(
  child: ChildProcess,
  timeoutMs: number,
): Promise<number | null | 'running'> {
  return new Promise((resolve) => {
    const timer = setTimeout(() => resolve('running'), timeoutMs);
    child.once('exit', (code) => {
      clearTimeout(timer);
      resolve(code);
    });
  });
}

test.describe('app lifecycle and security', () => {
  let packaged: PackagedApp | undefined;
  let dir: string;

  test.beforeEach(async () => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'xshot-lifecycle-'));
  });

  test.afterEach(async () => {
    await packaged?.close();
    packaged = undefined;
    fs.rmSync(dir, { recursive: true, force: true });
  });

  test('a second launch exits and brings the running app forward', async () => {
    packaged = await launchPackagedApp(SEED, { userDataDir: dir });
    const current = packaged;
    const editorVisible = () =>
      current.app.evaluate(({ BrowserWindow }) =>
        BrowserWindow.getAllWindows().some(
          (win) => !win.webContents.getURL().includes('#/') && win.isVisible(),
        ),
      );
    await expect.poll(editorVisible).toBe(true);
    await current.app.evaluate(({ BrowserWindow }) =>
      BrowserWindow.getAllWindows().forEach((win) => win.hide()),
    );
    await expect.poll(editorVisible).toBe(false);

    const second = launchSecondInstance(dir);
    try {
      expect(await exitCodeWithin(second, 15_000)).toBe(0);
    } finally {
      if (second.exitCode === null) second.kill();
    }
    await expect.poll(editorVisible).toBe(true);
    expect(await openRoutes(current)).toEqual(['editor']);
  });

  test('pages cannot navigate away; only https links open, in the browser', async () => {
    packaged = await launchPackagedApp(SEED, { userDataDir: dir });
    const current = packaged;
    const page = current.window;
    await recordOpenedUrls(current);
    const appUrl = page.url();

    await page.evaluate(() => {
      window.location.href = 'https://example.com/';
    });
    await page.waitForTimeout(1000);
    expect(page.url()).toBe(appUrl);

    const opened = await page.evaluate(() => [
      window.open('https://example.com/docs') === null,
      window.open('file:///etc/hosts') === null,
      window.open('http://example.com/') === null,
    ]);
    expect(opened).toEqual([true, true, true]);
    await expect
      .poll(() => openedUrls(current))
      .toEqual(['https://example.com/docs']);
    expect(await openRoutes(current)).toEqual(['editor']);
  });

  test('the menus show the saved shortcuts from launch', async () => {
    packaged = await launchPackagedApp(
      {
        ...SEED,
        capture: {
          hotkey: 'CommandOrControl+Alt+F7',
          hotkeyDelay3: 'CommandOrControl+Alt+F8',
          hotkeyDelay5: 'CommandOrControl+Alt+F9',
          hotkeyRecapture: 'CommandOrControl+Alt+F10',
        },
      },
      { userDataDir: dir },
    );
    const menu = await packaged.app.evaluate(({ Menu }) =>
      (Menu.getApplicationMenu()?.items ?? []).map((top) => ({
        label: top.label.replace('&', ''),
        items: (top.submenu?.items ?? []).map((item) => ({
          label: item.label.replace('&', ''),
          role: item.role?.toLowerCase() ?? null,
          accelerator: item.accelerator ?? null,
        })),
      })),
    );
    const capture = menu.find((top) => top.label === 'Capture');
    const shortcutOf = (label: string) =>
      capture?.items.find((item) => item.label === label)?.accelerator;
    expect(shortcutOf('Take Screenshot')).toBe('CommandOrControl+Alt+F7');
    expect(shortcutOf('Delayed Screenshot (3s)')).toBe(
      'CommandOrControl+Alt+F8',
    );
    expect(shortcutOf('Delayed Screenshot (5s)')).toBe(
      'CommandOrControl+Alt+F9',
    );
    expect(shortcutOf('Re-capture Last Area')).toBe('CommandOrControl+Alt+F10');

    const labels = menu.flatMap((top) => top.items.map((item) => item.label));
    expect(labels).not.toContain('Open');
    expect(labels).not.toContain('Learn More');
    if (process.platform === 'darwin') {
      const edit = menu.find((top) => top.label === 'Edit');
      expect(edit?.items.map((item) => item.role)).toEqual([
        'undo',
        'redo',
        null,
        'cut',
        'copy',
        'paste',
        'selectall',
      ]);
    }
  });

  test('title bar actions act on the window that sent them', async () => {
    packaged = await launchPackagedApp(SEED, { userDataDir: dir });
    const current = packaged;
    const preferences = await openPreferences(current);

    preferences
      .evaluate(() => window.electron.windowControls.close())
      .catch(() => undefined);
    await expect.poll(() => openRoutes(current)).toEqual(['editor']);

    expect(
      await current.window.evaluate(() =>
        window.electron.ipcRenderer.invoke('window-control', null as never),
      ),
    ).toBe(false);
    expect(await openRoutes(current)).toEqual(['editor']);
  });

  test('a change typed just before Preferences closes is saved', async () => {
    packaged = await launchPackagedApp(SEED, { userDataDir: dir });
    const current = packaged;
    await expect(
      await filenamePatternField(await openPreferences(current)),
    ).toBeVisible();

    const gapMs = await typeThen(current, 'saved-on-close', 'close');
    // Preferences closed before the change could save on its own.
    expect(gapMs).toBeLessThan(DEBOUNCE_MS);

    await expect.poll(() => openRoutes(current)).toEqual(['editor']);
    await expect
      .poll(() => storedPattern(dir), { timeout: 5_000 })
      .toBe('saved-on-close');
  });

  test('a change typed just before quitting is saved', async () => {
    packaged = await launchPackagedApp(SEED, { userDataDir: dir });
    const current = packaged;
    await expect(
      await filenamePatternField(await openPreferences(current)),
    ).toBeVisible();

    const closed = current.app.waitForEvent('close', { timeout: 30_000 });
    const gapMs = await typeThen(current, 'saved-on-quit', 'quit');
    expect(gapMs).toBeLessThan(DEBOUNCE_MS);
    await closed;
    packaged = undefined;

    expect(storedPattern(dir)).toBe('saved-on-quit');
  });

  test('logs stay in the profile, redacted, with no unhandled rejections', async () => {
    packaged = await launchPackagedApp(SEED, { userDataDir: dir });
    const current = packaged;
    await current.window.evaluate(() =>
      window.electron.ipcRenderer.log({
        level: 'info',
        scope: 'e2e',
        message: 'probe data:image/png;base64,QUJDREVG',
        meta: { image: 'data:image/png;base64,QUJDREVG' },
      }),
    );
    const preferences = await openPreferences(current);
    await preferences.close();
    await expect.poll(() => openRoutes(current)).toEqual(['editor']);
    const { logs } = current;
    await current.close();
    packaged = undefined;

    const logFile = path.join(dir, 'logs', 'main.log');
    expect(fs.existsSync(logFile)).toBe(true);
    const text = fs.readFileSync(logFile, 'utf-8');
    expect(text).toContain('[e2e] probe [redacted:len=');
    expect(text).not.toContain('QUJDREVG');
    expect(text).toContain('Update check skipped');
    expect(text).not.toMatch(/Unhandled promise rejection|app-update\.yml/);
    expect(logs.join('\n')).not.toMatch(/UnhandledPromiseRejection/);
  });
});
