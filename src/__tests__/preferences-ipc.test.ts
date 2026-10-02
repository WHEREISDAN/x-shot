/**
 * @jest-environment node
 */
import { app } from 'electron';
import { loadPreferences, updatePreferences } from '../main/preferences';
import {
  applyPreferencesUpdate,
  setHotkeysHandler,
  type HotkeysHandler,
} from '../main/ipc/preferences';
import PREFERENCES from './fixtures/preferences';

jest.mock('electron', () => ({
  app: { setLoginItemSettings: jest.fn() },
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

beforeEach(() => {
  jest.clearAllMocks();
  (loadPreferences as jest.Mock).mockResolvedValue(PREFERENCES);
  (updatePreferences as jest.Mock).mockImplementation(async (updates) => ({
    ...PREFERENCES,
    ...updates,
  }));
  hotkeys = {
    apply: jest.fn((changes) =>
      changes.main === TAKEN ? [{ label: 'main', accelerator: TAKEN }] : [],
    ),
    saved: jest.fn(),
  };
  setHotkeysHandler(hotkeys as HotkeysHandler);
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
    await applyPreferencesUpdate({
      preferences: { system: { launchAtStartup: true } },
    });
    expect(app.setLoginItemSettings).toHaveBeenCalledWith({
      openAtLogin: true,
      name: 'X-Shot',
    });
  });
});
