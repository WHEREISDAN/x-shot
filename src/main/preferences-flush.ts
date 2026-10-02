import { randomUUID } from 'crypto';
import {
  app,
  BrowserWindow,
  ipcMain,
  type IpcMainEvent,
  type WebContents,
} from 'electron';
import log from 'electron-log';
import type { FlushPreferencesRequest } from '../shared/ipc-types';

// A window that cannot answer in time must not block closing or quitting.
const FLUSH_TIMEOUT_MS = 1500;

const pending = new Map<string, () => void>();
let quitting = false;

/** True once pending changes are saved and the app is really quitting. */
export const isQuitting = (): boolean => quitting;

/**
 * Asks a window to save its pending preference changes (sliders and text
 * fields wait 300 ms before saving) and resolves once it has, or after a
 * timeout. Windows still loading have nothing pending.
 */
export function flushWindowPreferences(
  contents: WebContents,
  timeoutMs = FLUSH_TIMEOUT_MS,
): Promise<void> {
  if (contents.isDestroyed() || contents.isCrashed() || contents.isLoading()) {
    return Promise.resolve();
  }
  const requestId = randomUUID();
  return new Promise<void>((resolve) => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const finish = () => {
      clearTimeout(timer);
      pending.delete(requestId);
      resolve();
    };
    timer = setTimeout(() => {
      log.warn('A window did not save its pending preferences in time');
      finish();
    }, timeoutMs);
    pending.set(requestId, finish);
    contents.send('flush-preferences', {
      requestId,
    } satisfies FlushPreferencesRequest);
  });
}

export async function flushAllWindowPreferences(): Promise<void> {
  await Promise.all(
    BrowserWindow.getAllWindows().map((win) =>
      flushWindowPreferences(win.webContents),
    ),
  );
}

/** Saves a window's pending preference changes before it closes. */
export function flushPreferencesOnClose(win: BrowserWindow): void {
  let flushed = false;
  win.on('close', (event) => {
    // Quitting has already saved every window; delaying a close would
    // cancel the quit.
    if (flushed || quitting) return;
    event.preventDefault();
    flushed = true;
    const closeNow = () => {
      if (!win.isDestroyed()) win.close();
    };
    flushWindowPreferences(win.webContents)
      .then(closeNow, closeNow)
      .catch(() => undefined);
  });
}

/**
 * Quits only after every window has saved its pending changes and the
 * preferences write queue is drained.
 */
export default function installPreferencesFlush(
  drainWriteQueue: () => Promise<void>,
): void {
  ipcMain.on('preferences-flushed', (_event: IpcMainEvent, req: unknown) => {
    const { requestId } = (req as Partial<FlushPreferencesRequest>) || {};
    if (typeof requestId === 'string') pending.get(requestId)?.();
  });

  let saved = false;
  app.on('before-quit', (event) => {
    if (saved) {
      quitting = true;
      return;
    }
    event.preventDefault();
    saved = true;
    const saveThenQuit = async () => {
      try {
        await flushAllWindowPreferences();
        await drainWriteQueue();
      } catch (error) {
        log.error('Failed to save preferences before quitting:', error);
      }
      app.quit();
    };
    saveThenQuit().catch(() => undefined);
  });
}
