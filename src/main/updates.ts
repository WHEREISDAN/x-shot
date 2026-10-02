import fs from 'fs';
import path from 'path';
import { app } from 'electron';
import { autoUpdater } from 'electron-updater';
import log from 'electron-log';

let checked = false;

/** Written by electron-builder into published builds only. */
const updateConfigPath = (): string =>
  path.join(process.resourcesPath, 'app-update.yml');

/**
 * Checks for updates once per launch. Unpackaged runs and builds without
 * update config (e.g. unpacked test builds) skip the check, and a failed
 * check is logged, never left as an unhandled rejection.
 */
export default async function checkForUpdatesOnce(): Promise<void> {
  if (checked) return;
  checked = true;
  if (!app.isPackaged) return;
  if (!fs.existsSync(updateConfigPath())) {
    log.info('Update check skipped: this build has no update config');
    return;
  }
  autoUpdater.logger = log;
  try {
    await autoUpdater.checkForUpdatesAndNotify();
  } catch (error) {
    log.warn(
      'Update check failed:',
      error instanceof Error ? error.message : String(error),
    );
  }
}
