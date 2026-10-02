/**
 * @jest-environment node
 */
import { app, BrowserWindow, ipcMain } from 'electron';
import installPreferencesFlush, {
  flushPreferencesOnClose,
  flushWindowPreferences,
} from '../main/preferences-flush';

jest.mock('electron', () => ({
  app: { on: jest.fn(), quit: jest.fn() },
  ipcMain: { on: jest.fn() },
  BrowserWindow: { getAllWindows: jest.fn(() => []) },
}));
jest.mock('electron-log', () => ({ warn: jest.fn(), error: jest.fn() }));

type Listener = (...args: unknown[]) => void;

/** Main's 'preferences-flushed' listener, as the renderer reaches it. */
function acknowledge(requestId: string) {
  const [, listener] = (ipcMain.on as jest.Mock).mock.calls.find(
    ([channel]) => channel === 'preferences-flushed',
  );
  listener({}, { requestId });
}

/** A window whose renderer saves for `saveMs` before acknowledging. */
function fakeContents(order: string[], name: string, saveMs = 0) {
  return {
    isDestroyed: () => false,
    isCrashed: () => false,
    isLoading: () => false,
    send: jest.fn((_channel: string, { requestId }: { requestId: string }) => {
      setTimeout(() => {
        order.push(`${name} saved`);
        acknowledge(requestId);
      }, saveMs);
    }),
  };
}

function fakeWindow(contents: ReturnType<typeof fakeContents>) {
  const listeners = new Map<string, Listener>();
  return {
    listeners,
    webContents: contents,
    isDestroyed: () => false,
    on: (event: string, listener: Listener) => listeners.set(event, listener),
    close: jest.fn(),
  };
}

let beforeQuit: Listener;
const drain = jest.fn(async () => undefined);

beforeAll(() => {
  installPreferencesFlush(drain);
  [, beforeQuit] = (app.on as jest.Mock).mock.calls.find(
    ([event]) => event === 'before-quit',
  );
});

beforeEach(() => {
  jest.useFakeTimers();
  (app.quit as jest.Mock).mockClear();
});

afterEach(() => jest.useRealTimers());

describe('flushWindowPreferences', () => {
  it('resolves once the window says its changes are saved', async () => {
    const order: string[] = [];
    const contents = fakeContents(order, 'preferences', 200);
    const done = flushWindowPreferences(contents as never).then(() =>
      order.push('flushed'),
    );
    await jest.advanceTimersByTimeAsync(200);
    await done;
    expect(order).toEqual(['preferences saved', 'flushed']);
  });

  it('gives up on a window that never answers', async () => {
    const contents = { ...fakeContents([], 'stuck'), send: jest.fn() };
    const state = { done: false };
    const flushed = flushWindowPreferences(contents as never, 1500).then(() =>
      Object.assign(state, { done: true }),
    );
    await jest.advanceTimersByTimeAsync(1499);
    expect(state.done).toBe(false);
    await jest.advanceTimersByTimeAsync(1);
    await flushed;
    expect(state.done).toBe(true);
  });

  it('skips a window that is still loading', async () => {
    const contents = { ...fakeContents([], 'loading'), isLoading: () => true };
    await flushWindowPreferences(contents as never);
    expect(contents.send).not.toHaveBeenCalled();
  });
});

describe('closing a window', () => {
  it('saves its pending changes first, then closes it', async () => {
    const order: string[] = [];
    const win = fakeWindow(fakeContents(order, 'preferences', 50));
    win.close.mockImplementation(() => order.push('closed'));
    flushPreferencesOnClose(win as never);

    const event = { preventDefault: jest.fn() };
    win.listeners.get('close')?.(event);
    expect(event.preventDefault).toHaveBeenCalled();
    await jest.advanceTimersByTimeAsync(50);
    expect(order).toEqual(['preferences saved', 'closed']);

    // The second close goes through.
    const again = { preventDefault: jest.fn() };
    win.listeners.get('close')?.(again);
    expect(again.preventDefault).not.toHaveBeenCalled();
  });
});

describe('quitting', () => {
  it('saves every window, then drains the write queue, then quits', async () => {
    const order: string[] = [];
    const editor = fakeWindow(fakeContents(order, 'editor', 10));
    const preferences = fakeWindow(fakeContents(order, 'preferences', 120));
    (BrowserWindow.getAllWindows as jest.Mock).mockReturnValue([
      editor,
      preferences,
    ]);
    drain.mockImplementation(async () => {
      order.push('queue drained');
    });
    const quitHandler = beforeQuit;
    (app.quit as jest.Mock).mockImplementation(() => order.push('quit'));

    const event = { preventDefault: jest.fn() };
    quitHandler(event);
    expect(event.preventDefault).toHaveBeenCalled();
    expect(app.quit).not.toHaveBeenCalled();
    await jest.advanceTimersByTimeAsync(120);

    expect(order).toEqual([
      'editor saved',
      'preferences saved',
      'queue drained',
      'quit',
    ]);
    // The quit that follows is let through.
    const second = { preventDefault: jest.fn() };
    quitHandler(second);
    expect(second.preventDefault).not.toHaveBeenCalled();
  });

  it('lets windows close without waiting once quitting', () => {
    const win = fakeWindow(fakeContents([], 'editor'));
    flushPreferencesOnClose(win as never);
    beforeQuit({ preventDefault: jest.fn() });
    beforeQuit({ preventDefault: jest.fn() });
    const event = { preventDefault: jest.fn() };
    win.listeners.get('close')?.(event);
    expect(event.preventDefault).not.toHaveBeenCalled();
  });
});
