/**
 * @jest-environment node
 */
import { ipcMain, shell } from 'electron';
import registerScreenPermissionHandlers, {
  SCREEN_RECORDING_SETTINGS_URL,
  screenCaptureAllowed,
  type ScreenAccessStatus,
} from '../main/screen-permission';

jest.mock('electron', () => ({
  ipcMain: { handle: jest.fn() },
  shell: { openExternal: jest.fn(async () => undefined) },
  systemPreferences: { getMediaAccessStatus: jest.fn() },
}));
jest.mock('../main/logger', () => ({
  getLogger: () => ({ error: jest.fn(), info: jest.fn(), warn: jest.fn() }),
}));

describe('screenCaptureAllowed', () => {
  it.each([
    ['granted', true],
    ['not-determined', true],
    ['unknown', true],
    ['denied', false],
    ['restricted', false],
  ] as Array<[ScreenAccessStatus, boolean]>)(
    'on macOS, %s gives %s',
    (status, allowed) => {
      expect(screenCaptureAllowed('darwin', () => status)).toBe(allowed);
    },
  );

  it.each(['win32', 'linux'] as const)(
    'on %s never reads the status',
    (platform) => {
      const readStatus = jest.fn((): ScreenAccessStatus => 'denied');
      expect(screenCaptureAllowed(platform, readStatus)).toBe(true);
      expect(readStatus).not.toHaveBeenCalled();
    },
  );
});

describe('open-screen-recording-settings', () => {
  const realPlatform = process.platform;
  const setPlatform = (value: string) =>
    Object.defineProperty(process, 'platform', { value });

  function handler(): (...args: unknown[]) => Promise<boolean> {
    registerScreenPermissionHandlers();
    const call = (ipcMain.handle as jest.Mock).mock.calls.find(
      ([channel]) => channel === 'open-screen-recording-settings',
    );
    return call[1];
  }

  afterEach(() => {
    setPlatform(realPlatform);
    jest.clearAllMocks();
  });

  it('opens only the fixed Screen Recording settings URL', async () => {
    setPlatform('darwin');
    // Whatever the renderer sends, the handler ignores it.
    await expect(handler()({}, 'https://example.com')).resolves.toBe(true);
    expect(shell.openExternal).toHaveBeenCalledTimes(1);
    expect(shell.openExternal).toHaveBeenCalledWith(
      'x-apple.systempreferences:com.apple.preference.security?Privacy_ScreenCapture',
    );
    expect(SCREEN_RECORDING_SETTINGS_URL).toBe(
      'x-apple.systempreferences:com.apple.preference.security?Privacy_ScreenCapture',
    );
  });

  it('does nothing on other platforms', async () => {
    setPlatform('win32');
    await expect(handler()({})).resolves.toBe(false);
    expect(shell.openExternal).not.toHaveBeenCalled();
  });
});
