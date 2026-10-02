import fs from 'fs';
import os from 'os';
import path from 'path';
import {
  _electron as electron,
  expect,
  type ElectronApplication,
  type Page,
} from '@playwright/test';
import webpackPaths from '../.erb/configs/webpack.paths';
import type { AppPreferences, ScreenshotResult } from '../src/shared/ipc-types';

const PRODUCT_NAME = 'X-Shot';

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
export async function launchPackagedApp(
  preferences: Partial<AppPreferences>,
): Promise<PackagedApp> {
  const userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'xshot-smoke-'));
  fs.writeFileSync(
    path.join(userDataDir, 'preferences.json'),
    JSON.stringify(preferences),
  );

  const args = [`--user-data-dir=${userDataDir}`];
  // Unpacked Linux builds lack a SUID sandbox helper on CI runners.
  if (process.platform === 'linux') args.push('--no-sandbox');

  const app = await electron.launch({
    executablePath: findPackagedExecutable(),
    args,
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
      fs.rmSync(userDataDir, { recursive: true, force: true });
    },
  };
}

export function pngDataUrl(filePath: string): string {
  return `data:image/png;base64,${fs.readFileSync(filePath).toString('base64')}`;
}

/**
 * Sends a capture result through the same main-to-editor channel a real
 * capture uses. Retries until the editor mounts, because the renderer only
 * subscribes after its first render.
 */
export async function deliverScreenshot(
  { app, window }: PackagedApp,
  payload: ScreenshotResult,
): Promise<void> {
  await window.getByText('Waiting for screenshot…').waitFor();
  await expect(async () => {
    await app.evaluate(({ BrowserWindow }, data) => {
      const editor = BrowserWindow.getAllWindows().find(
        (win) => !win.webContents.getURL().includes('#/'),
      );
      if (!editor) throw new Error('Main window not found');
      editor.webContents.send('screenshot-data', data);
    }, payload);
    await expect(window.getByText('Censor PII')).toBeVisible({
      timeout: 2_000,
    });
  }).toPass({ timeout: 20_000 });
}
