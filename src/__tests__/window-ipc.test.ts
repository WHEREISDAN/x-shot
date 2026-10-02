/**
 * @jest-environment node
 */
import { BrowserWindow, ipcMain } from 'electron';
import registerWindowIpcHandlers from '../main/ipc/window';
import { trackWindowState, windowControlAction } from '../main/window-state';

jest.mock('electron', () => ({
  ipcMain: { handle: jest.fn() },
  BrowserWindow: { fromWebContents: jest.fn() },
}));

type Listener = () => void;

function fakeWindow() {
  const listeners = new Map<string, Listener[]>();
  const on = (event: string, listener: Listener) => {
    listeners.set(event, [...(listeners.get(event) ?? []), listener]);
  };
  let maximized = false;
  return {
    listeners,
    isDestroyed: () => false,
    isMaximized: () => maximized,
    isFullScreen: () => false,
    isFocused: () => true,
    minimize: jest.fn(),
    maximize: jest.fn(() => {
      maximized = true;
    }),
    unmaximize: jest.fn(() => {
      maximized = false;
    }),
    close: jest.fn(),
    on: jest.fn(on),
    webContents: { send: jest.fn(), on: jest.fn(on) },
  };
}

type FakeWindow = ReturnType<typeof fakeWindow>;

function handlers() {
  registerWindowIpcHandlers();
  const handlerFor = (channel: string) =>
    (ipcMain.handle as jest.Mock).mock.calls.find(([c]) => c === channel)[1];
  return {
    control: handlerFor('window-control'),
    state: handlerFor('get-window-state'),
  };
}

const eventFrom = (sender: object) => ({ sender });

afterEach(() => jest.clearAllMocks());

describe('windowControlAction', () => {
  it.each([
    [{ action: 'minimize' }, 'minimize'],
    [{ action: 'toggle-maximize' }, 'toggle-maximize'],
    [{ action: 'close' }, 'close'],
  ])('accepts %j', (payload, action) => {
    expect(windowControlAction(payload)).toBe(action);
  });

  it.each([null, undefined, 'close', 42, {}, { action: 'destroy' }, []])(
    'refuses %j',
    (payload) => {
      expect(windowControlAction(payload)).toBeNull();
    },
  );
});

describe('window-control', () => {
  it('acts on the window that sent it, not the editor', async () => {
    const editor = fakeWindow();
    const preferences = fakeWindow();
    (BrowserWindow.fromWebContents as jest.Mock).mockImplementation(
      (contents) =>
        contents === preferences.webContents ? preferences : editor,
    );
    const { control } = handlers();

    await expect(
      control(eventFrom(preferences.webContents), { action: 'close' }),
    ).resolves.toBe(true);
    await control(eventFrom(preferences.webContents), {
      action: 'toggle-maximize',
    });

    expect(preferences.close).toHaveBeenCalledTimes(1);
    expect(preferences.maximize).toHaveBeenCalledTimes(1);
    expect(editor.close).not.toHaveBeenCalled();
    expect(editor.maximize).not.toHaveBeenCalled();
  });

  it('refuses a malformed payload without touching any window', async () => {
    const win = fakeWindow();
    (BrowserWindow.fromWebContents as jest.Mock).mockReturnValue(win);
    const { control } = handlers();
    await expect(control(eventFrom(win.webContents), null)).resolves.toBe(
      false,
    );
    await expect(
      control(eventFrom(win.webContents), { action: 'destroy' }),
    ).resolves.toBe(false);
    expect(win.close).not.toHaveBeenCalled();
  });

  it('refuses a sender without a window', async () => {
    (BrowserWindow.fromWebContents as jest.Mock).mockReturnValue(null);
    const { control } = handlers();
    await expect(control(eventFrom({}), { action: 'close' })).resolves.toBe(
      false,
    );
  });
});

describe('window state', () => {
  it("reports the sender's own window", async () => {
    const preferences = fakeWindow();
    preferences.maximize();
    (BrowserWindow.fromWebContents as jest.Mock).mockReturnValue(preferences);
    const { state } = handlers();
    await expect(state(eventFrom(preferences.webContents))).resolves.toEqual(
      expect.objectContaining({ isMaximized: true, isFocused: true }),
    );
  });

  it('sends each tracked window its own state changes', () => {
    const editor = fakeWindow();
    const preferences = fakeWindow();
    trackWindowState(editor as unknown as BrowserWindow);
    trackWindowState(preferences as unknown as BrowserWindow);

    preferences.maximize();
    preferences.listeners.get('maximize')?.forEach((emit) => emit());

    expect(preferences.webContents.send).toHaveBeenCalledWith(
      'window-state',
      expect.objectContaining({ isMaximized: true }),
    );
    expect(editor.webContents.send).not.toHaveBeenCalled();
    const tracked = (win: FakeWindow) => [...win.listeners.keys()].sort();
    expect(tracked(editor)).toEqual(tracked(preferences));
  });
});
