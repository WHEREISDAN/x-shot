/**
 * @jest-environment node
 */
import fs from 'fs';
import { app } from 'electron';
import { autoUpdater } from 'electron-updater';
import log from 'electron-log';

jest.mock('electron', () => ({ app: { isPackaged: true } }));
jest.mock('electron-updater', () => ({
  autoUpdater: { checkForUpdatesAndNotify: jest.fn() },
}));
jest.mock('electron-log', () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
}));

const check = autoUpdater.checkForUpdatesAndNotify as jest.Mock;

/** A fresh copy of the module, since it checks once per launch. */
function loadModule(): () => Promise<void> {
  let checkOnce: () => Promise<void> = async () => undefined;
  jest.isolateModules(() => {
    // eslint-disable-next-line global-require
    checkOnce = require('../main/updates').default;
  });
  return checkOnce;
}

beforeEach(() => {
  jest.clearAllMocks();
  Object.assign(app, { isPackaged: true });
  Object.defineProperty(process, 'resourcesPath', {
    value: '/app/resources',
    configurable: true,
  });
  jest.spyOn(fs, 'existsSync').mockReturnValue(true);
});

afterEach(() => jest.restoreAllMocks());

it('checks once per launch', async () => {
  check.mockResolvedValue(null);
  const checkOnce = loadModule();
  await checkOnce();
  await checkOnce();
  expect(check).toHaveBeenCalledTimes(1);
});

it('logs a failed check instead of leaving a rejection', async () => {
  check.mockRejectedValue(new Error('ENOENT app-update.yml'));
  await expect(loadModule()()).resolves.toBeUndefined();
  expect(log.warn).toHaveBeenCalledWith(
    'Update check failed:',
    'ENOENT app-update.yml',
  );
});

it('skips builds without update config', async () => {
  (fs.existsSync as jest.Mock).mockReturnValue(false);
  await loadModule()();
  expect(check).not.toHaveBeenCalled();
  expect(log.info).toHaveBeenCalledWith(
    'Update check skipped: this build has no update config',
  );
});

it('skips unpackaged runs', async () => {
  Object.assign(app, { isPackaged: false });
  await loadModule()();
  expect(check).not.toHaveBeenCalled();
});
