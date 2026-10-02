import { ipcMain, shell, systemPreferences } from 'electron';
import { getLogger } from './logger';

const log = getLogger('screen-permission');

// The only URL this module opens: macOS Privacy & Security > Screen
// Recording. It is fixed here; the renderer cannot pass a URL.
export const SCREEN_RECORDING_SETTINGS_URL =
  'x-apple.systempreferences:com.apple.preference.security?Privacy_ScreenCapture';

type Platform = typeof process.platform;
export type ScreenAccessStatus = ReturnType<
  typeof systemPreferences.getMediaAccessStatus
>;

/**
 * Whether a capture may start. On macOS only an explicit refusal blocks it;
 * 'not-determined' proceeds so macOS can show its own prompt. Other
 * platforms have no such permission, so their status is never read.
 */
export function screenCaptureAllowed(
  platform: Platform,
  readStatus: () => ScreenAccessStatus,
): boolean {
  if (platform !== 'darwin') return true;
  const status = readStatus();
  return status !== 'denied' && status !== 'restricted';
}

export function isScreenCaptureDenied(): boolean {
  return !screenCaptureAllowed(process.platform, () =>
    systemPreferences.getMediaAccessStatus('screen'),
  );
}

export default function registerScreenPermissionHandlers() {
  ipcMain.handle('open-screen-recording-settings', async () => {
    if (process.platform !== 'darwin') return false;
    try {
      await shell.openExternal(SCREEN_RECORDING_SETTINGS_URL);
      return true;
    } catch (error) {
      log.error('Failed to open Screen Recording settings', error);
      return false;
    }
  });
}
