/**
 * @jest-environment node
 */
import { app, BrowserWindow, ipcMain } from 'electron';
import {
  loadPreferences,
  resetPreferences,
  updatePreferences,
} from '../main/preferences';
import registerPreferencesIpcHandlers, {
  applyPreferencesUpdate,
  setHotkeysHandler,
  setTrayVisibilityChangeCallback,
  type HotkeysHandler,
} from '../main/ipc/preferences';
import PREFERENCES from './fixtures/preferences';

jest.mock('electron', () => ({
  app: { setLoginItemSettings: jest.fn() },
  BrowserWindow: { getAllWindows: jest.fn(() => []) },
  ipcMain: { on: jest.fn(), handle: jest.fn() },
}));
jest.mock('electron-log', () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
}));
jest.mock('../main/windows', () => ({ createPreferencesWindow: jest.fn() }));
jest.mock('../main/preferences', () => ({
  loadPreferences: jest.fn(),
  updatePreferences: jest.fn(),
  resetPreferences: jest.fn(),
  saveBackgroundImage: jest.fn(),
}));

const TAKEN = 'CommandOrControl+Shift+K';

let hotkeys: { apply: jest.Mock; saved: jest.Mock };
let onTrayVisibilityChange: jest.Mock;

const makeFakeWindow = (destroyed = false) => ({
  isDestroyed: () => destroyed,
  webContents: { send: jest.fn() },
});

function withPlatform<T>(
  platform: typeof process.platform,
  run: () => Promise<T>,
): Promise<T> {
  const original = process.platform;
  Object.defineProperty(process, 'platform', {
    value: platform,
    configurable: true,
  });
  return run().finally(() => {
    Object.defineProperty(process, 'platform', {
      value: original,
      configurable: true,
    });
  });
}

function getRegisteredHandler(
  channel: string,
): (...args: unknown[]) => unknown {
  registerPreferencesIpcHandlers();
  const entry = (ipcMain.handle as jest.Mock).mock.calls
    .slice()
    .reverse()
    .find(([name]) => name === channel);
  if (!entry) throw new Error(`Handler not registered: ${channel}`);
  return entry[1] as (...args: unknown[]) => unknown;
}

beforeEach(() => {
  jest.clearAllMocks();
  (BrowserWindow.getAllWindows as jest.Mock).mockReturnValue([]);
  (loadPreferences as jest.Mock).mockResolvedValue(PREFERENCES);
  (updatePreferences as jest.Mock).mockImplementation(async (updates) => ({
    ...PREFERENCES,
    ...updates,
    system: { ...PREFERENCES.system, ...updates.system },
    capture: { ...PREFERENCES.capture, ...updates.capture },
  }));
  (resetPreferences as jest.Mock).mockResolvedValue({
    ...PREFERENCES,
    capture: {
      ...PREFERENCES.capture,
      hotkey: 'CommandOrControl+Shift+1',
      hotkeyDelay3: null,
      hotkeyDelay5: null,
      hotkeyRecapture: null,
    },
    system: { launchAtStartup: false, showInTray: true },
  });
  hotkeys = {
    apply: jest.fn((changes) =>
      changes.main === TAKEN ? [{ label: 'main', accelerator: TAKEN }] : [],
    ),
    saved: jest.fn(),
  };
  onTrayVisibilityChange = jest.fn();
  setHotkeysHandler(hotkeys as HotkeysHandler);
  setTrayVisibilityChangeCallback(onTrayVisibilityChange);
});

describe('set-preferences', () => {
  it.each([
    ['no payload', undefined],
    ['preferences that are not an object', { preferences: 'dark' }],
    ['an unknown section', { preferences: { theme: {} } }],
    ['a section that is not an object', { preferences: { editor: 5 } }],
  ])('refuses %s', async (_label, request) => {
    await expect(applyPreferencesUpdate(request)).resolves.toEqual({
      ok: false,
      error: 'Invalid preferences request.',
    });
    expect(updatePreferences).not.toHaveBeenCalled();
  });

  it('returns the saved preferences', async () => {
    const result = await applyPreferencesUpdate({
      preferences: { export: { autoSave: true } },
    });
    expect(result.ok).toBe(true);
    expect(updatePreferences).toHaveBeenCalledWith({
      export: { autoSave: true },
    });
  });

  it('reports a disk error instead of success', async () => {
    (updatePreferences as jest.Mock).mockRejectedValue(
      new Error('EACCES: permission denied'),
    );
    await expect(
      applyPreferencesUpdate({ preferences: { export: { autoSave: true } } }),
    ).resolves.toEqual({
      ok: false,
      error: 'Your preferences could not be saved: EACCES: permission denied',
    });
  });

  it('refuses a shortcut that is taken and saves nothing', async () => {
    const result = await applyPreferencesUpdate({
      preferences: { capture: { hotkey: TAKEN } },
    });
    expect(result).toEqual({
      ok: false,
      error: expect.stringContaining(TAKEN),
    });
    expect(hotkeys.apply).toHaveBeenCalledWith({ main: TAKEN });
    expect(updatePreferences).not.toHaveBeenCalled();
    expect(hotkeys.saved).not.toHaveBeenCalled();
  });

  it('registers a free shortcut, saves it, then refreshes menus', async () => {
    const result = await applyPreferencesUpdate({
      preferences: { capture: { hotkeyDelay5: 'CommandOrControl+Shift+5' } },
    });
    expect(result.ok).toBe(true);
    expect(hotkeys.apply).toHaveBeenCalledWith({
      delay5: 'CommandOrControl+Shift+5',
    });
    expect(hotkeys.saved).toHaveBeenCalledTimes(1);
  });

  it('puts the old shortcut back when the save fails', async () => {
    (updatePreferences as jest.Mock).mockRejectedValue(new Error('disk full'));
    const result = await applyPreferencesUpdate({
      preferences: { capture: { hotkey: 'CommandOrControl+Shift+9' } },
    });
    expect(result.ok).toBe(false);
    expect(hotkeys.apply).toHaveBeenLastCalledWith({
      main: PREFERENCES.capture.hotkey,
    });
  });

  it('leaves shortcuts alone when an update does not change them', async () => {
    await applyPreferencesUpdate({
      preferences: {
        capture: {
          hotkey: PREFERENCES.capture.hotkey,
          autoCopyToClipboard: true,
        },
      },
    });
    expect(hotkeys.apply).not.toHaveBeenCalled();
  });

  it('applies launch at startup only once saved', async () => {
    await withPlatform('darwin', async () => {
      await applyPreferencesUpdate({
        preferences: { system: { launchAtStartup: true } },
      });
    });
    expect(app.setLoginItemSettings).toHaveBeenCalledWith({
      openAtLogin: true,
      name: 'X-Shot',
    });
  });

  it('skips setLoginItemSettings on Linux', async () => {
    await withPlatform('linux', async () => {
      const result = await applyPreferencesUpdate({
        preferences: { system: { launchAtStartup: true } },
      });
      expect(result.ok).toBe(true);
    });
    expect(app.setLoginItemSettings).not.toHaveBeenCalled();
  });

  it('broadcasts preferences-changed to all non-destroyed windows after save', async () => {
    const liveA = makeFakeWindow(false);
    const liveB = makeFakeWindow(false);
    const closed = makeFakeWindow(true);
    (BrowserWindow.getAllWindows as jest.Mock).mockReturnValue([
      liveA,
      closed,
      liveB,
    ]);

    const result = await applyPreferencesUpdate({
      preferences: { export: { autoSave: true } },
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(liveA.webContents.send).toHaveBeenCalledWith(
      'preferences-changed',
      result.preferences,
    );
    expect(liveB.webContents.send).toHaveBeenCalledWith(
      'preferences-changed',
      result.preferences,
    );
    expect(closed.webContents.send).not.toHaveBeenCalled();
  });

  it('does not broadcast preferences-changed when save fails', async () => {
    const live = makeFakeWindow(false);
    (BrowserWindow.getAllWindows as jest.Mock).mockReturnValue([live]);
    (updatePreferences as jest.Mock).mockRejectedValue(new Error('disk full'));

    await applyPreferencesUpdate({
      preferences: { export: { autoSave: true } },
    });

    expect(live.webContents.send).not.toHaveBeenCalled();
  });
});

describe('reset-preferences', () => {
  it('reconciles hotkeys, menus, tray visibility, login item and broadcasts changes', async () => {
    const live = makeFakeWindow(false);
    const closed = makeFakeWindow(true);
    (BrowserWindow.getAllWindows as jest.Mock).mockReturnValue([live, closed]);
    const resetHandler = getRegisteredHandler('reset-preferences');

    const defaults = await withPlatform('darwin', () =>
      Promise.resolve(resetHandler() as Promise<unknown>),
    );

    expect(hotkeys.apply).toHaveBeenCalledWith({
      main: 'CommandOrControl+Shift+1',
      delay3: null,
      delay5: null,
      recapture: null,
    });
    expect(hotkeys.saved).toHaveBeenCalledTimes(1);
    expect(onTrayVisibilityChange).toHaveBeenCalledWith(true);
    expect(app.setLoginItemSettings).toHaveBeenCalledWith({
      openAtLogin: false,
      name: 'X-Shot',
    });
    expect(live.webContents.send).toHaveBeenCalledWith(
      'preferences-changed',
      defaults,
    );
    expect(closed.webContents.send).not.toHaveBeenCalled();
  });

  it('skips setLoginItemSettings on Linux during reset while reconciling other OS state', async () => {
    const resetHandler = getRegisteredHandler('reset-preferences');

    await withPlatform('linux', () =>
      Promise.resolve(resetHandler() as Promise<unknown>),
    );

    expect(hotkeys.apply).toHaveBeenCalled();
    expect(hotkeys.saved).toHaveBeenCalledTimes(1);
    expect(onTrayVisibilityChange).toHaveBeenCalledWith(true);
    expect(app.setLoginItemSettings).not.toHaveBeenCalled();
  });

  it('skips OS side effects and broadcast if resetPreferences fails', async () => {
    const live = makeFakeWindow(false);
    (BrowserWindow.getAllWindows as jest.Mock).mockReturnValue([live]);
    (resetPreferences as jest.Mock).mockRejectedValueOnce(new Error('EACCES'));
    const resetHandler = getRegisteredHandler('reset-preferences');

    await expect(
      withPlatform('darwin', () =>
        Promise.resolve(resetHandler() as Promise<unknown>),
      ),
    ).rejects.toThrow('EACCES');

    expect(hotkeys.apply).not.toHaveBeenCalled();
    expect(hotkeys.saved).not.toHaveBeenCalled();
    expect(onTrayVisibilityChange).not.toHaveBeenCalled();
    expect(app.setLoginItemSettings).not.toHaveBeenCalled();
    expect(live.webContents.send).not.toHaveBeenCalled();
  });
});
