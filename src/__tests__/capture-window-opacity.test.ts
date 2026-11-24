/**
 * @jest-environment node
 */
import { EventEmitter } from 'events';
import { BrowserWindow, desktopCapturer, ipcMain, screen } from 'electron';
import {
  createMainWindow,
  createPreferencesWindow,
  ensureMainWindowReady,
  hideWindowsForCapture,
  restoreWindowsAfterCapture,
  showMainWindow,
} from '../main/windows';
import registerScreenshotIpcHandlers from '../main/ipc/screenshot';
import { captureAssets } from '../main/capture-assets';
import {
  cancelCapture,
  confirmCapture,
  resetCaptureCoordinatorForTests,
  startCapture,
} from '../main/capture-coordinator';
import type { ListCaptureSourcesResponse } from '../shared/ipc-types';

jest.mock('electron', () => ({
  app: { isPackaged: false },
  BrowserWindow: jest.fn(),
  Menu: { buildFromTemplate: jest.fn() },
  desktopCapturer: { getSources: jest.fn() },
  ipcMain: { on: jest.fn(), handle: jest.fn() },
  screen: {
    getAllDisplays: jest.fn(),
    getPrimaryDisplay: jest.fn(),
    getCursorScreenPoint: jest.fn(),
    getDisplayNearestPoint: jest.fn(),
  },
}));
jest.mock('electron-log', () => ({
  transports: { file: {}, console: {} },
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
}));
jest.mock('../main/capture-diagnostics', () => ({
  beginCaptureSession: jest.fn(),
  endCaptureSession: jest.fn(),
  markCaptureStage: jest.fn(),
}));
jest.mock('../main/screen-permission', () => ({
  isScreenCaptureDenied: () => false,
}));
jest.mock('../main/preferences', () => ({ updatePreferences: jest.fn() }));
jest.mock('../main/preferences-flush', () => ({
  flushPreferencesOnClose: jest.fn(),
}));
jest.mock('../main/window-state', () => ({ trackWindowState: jest.fn() }));

const DISPLAY = {
  id: 7,
  bounds: { x: 0, y: 0, width: 800, height: 600 },
  scaleFactor: 2,
};

interface FakeImage {
  getSize: () => { width: number; height: number };
  isEmpty: () => boolean;
  toPNG: () => Buffer;
  resize: (size: { width: number }) => FakeImage;
}

/** An image whose PNG bytes are its label, so tests can tell images apart. */
const fakeImage = (
  label: string,
  width: number,
  height: number,
): FakeImage => ({
  getSize: () => ({ width, height }),
  isEmpty: () => false,
  toPNG: () => Buffer.from(label),
  resize: (size) =>
    fakeImage(
      `${label} at ${size.width}`,
      size.width,
      Math.round((height * size.width) / width),
    ),
});

/** What the screen shows at the moment desktopCapturer is called. */
const sourcesShowing =
  (label: string) =>
  async (options: {
    types: string[];
    thumbnailSize: { width: number; height: number };
  }) => {
    const { width, height } = options.thumbnailSize;
    return options.types.includes('screen')
      ? [
          {
            id: 'screen:7:0',
            name: 'Screen 1',
            display_id: '7',
            appIcon: null,
            thumbnail: fakeImage(label, width, height),
          },
        ]
      : [
          {
            id: 'window:1:0',
            name: 'Window',
            display_id: '',
            appIcon: null,
            thumbnail: fakeImage(`${label} window`, width, height),
          },
        ];
  };

/**
 * A BrowserWindow that records its calls. Like Windows, it emits show and
 * hide as it changes; on macOS these follow from occlusion instead.
 */
class FakeWindow extends EventEmitter {
  readonly options: Record<string, unknown>;

  readonly calls: string[] = [];

  url = '';

  visible = false;

  opacity = 1;

  destroyed = false;

  /** False models a show event that never arrives. */
  emitsShow = true;

  readonly webContents = {
    isLoading: () => false,
    once: jest.fn(),
    on: jest.fn(),
    send: jest.fn(),
  };

  focus = jest.fn();

  restore = jest.fn();

  setAlwaysOnTop = jest.fn();

  setVisibleOnAllWorkspaces = jest.fn();

  setSimpleFullScreen = jest.fn();

  setFullScreen = jest.fn();

  isSimpleFullScreen = jest.fn(() => false);

  isMinimized = jest.fn(() => false);

  constructor(options: Record<string, unknown>) {
    super();
    this.options = options;
  }

  loadURL(url: string) {
    this.url = url;
    return Promise.resolve();
  }

  show() {
    this.reveal('show');
  }

  showInactive() {
    this.reveal('showInactive');
  }

  hide() {
    this.calls.push('hide');
    if (!this.visible) return;
    this.visible = false;
    this.emit('hide');
  }

  close() {
    this.visible = false;
    this.destroyed = true;
    this.emit('closed');
  }

  isVisible() {
    return this.visible;
  }

  isDestroyed() {
    return this.destroyed;
  }

  setOpacity(opacity: number) {
    this.calls.push(`opacity ${opacity}`);
    this.opacity = opacity;
  }

  private reveal(call: string) {
    this.calls.push(call);
    const wasVisible = this.visible;
    this.visible = true;
    if (!wasVisible && this.emitsShow) this.emit('show');
  }
}

/** Every window the code under test created, oldest first. */
const windows: FakeWindow[] = [];

const shownEditor = (): FakeWindow => {
  const editor = createMainWindow() as unknown as FakeWindow;
  editor.emit('ready-to-show');
  return editor;
};

const shownPreferences = async (): Promise<FakeWindow> => {
  const preferences =
    (await createPreferencesWindow()) as unknown as FakeWindow;
  preferences.emit('ready-to-show');
  return preferences;
};

const overlays = () => windows.filter((w) => w.url.includes('#/screenshot'));

const visibility = (win: FakeWindow) => ({
  visible: win.visible,
  opacity: win.opacity,
});
const SHOWN_OPAQUE = { visible: true, opacity: 1 };
const HIDDEN_TRANSPARENT = { visible: false, opacity: 0 };

const lastCaptureResult = (editor: FakeWindow) =>
  editor.webContents.send.mock.calls
    .filter(([channel]) => channel === 'capture-result')
    .map(([, result]) => result)
    .pop();

beforeEach(() => {
  windows.length = 0;
  (BrowserWindow as unknown as jest.Mock).mockImplementation(
    (options: Record<string, unknown>) => {
      const win = new FakeWindow(options);
      windows.push(win);
      return win;
    },
  );
  (screen.getAllDisplays as jest.Mock).mockReturnValue([DISPLAY]);
  (screen.getPrimaryDisplay as jest.Mock).mockReturnValue(DISPLAY);
  (screen.getCursorScreenPoint as jest.Mock).mockReturnValue({ x: 0, y: 0 });
  (screen.getDisplayNearestPoint as jest.Mock).mockReturnValue(DISPLAY);
  (desktopCapturer.getSources as jest.Mock).mockImplementation(
    sourcesShowing('before overlays'),
  );
  resetCaptureCoordinatorForTests();
  registerScreenshotIpcHandlers();
});

afterEach(async () => {
  await cancelCapture('app-quit');
  restoreWindowsAfterCapture();
  windows.filter((w) => !w.destroyed).forEach((w) => w.close());
  captureAssets.releaseWhere(() => true);
});

describe('hiding X-Shot windows for a capture', () => {
  it('makes each window transparent before hiding it', async () => {
    const editor = shownEditor();
    const preferences = await shownPreferences();

    await hideWindowsForCapture();

    expect(editor.calls.slice(-2)).toEqual(['opacity 0', 'hide']);
    expect(preferences.calls.slice(-2)).toEqual(['opacity 0', 'hide']);
    expect(visibility(editor)).toEqual(HIDDEN_TRANSPARENT);
    expect(visibility(preferences)).toEqual(HIDDEN_TRANSPARENT);
  });

  it.each([
    ['ensureMainWindowReady', () => ensureMainWindowReady()],
    ['showMainWindow', () => showMainWindow()],
    // The way a cancelled capture shows the editor.
    ['a direct show()', () => windows[0].show()],
  ])('the editor is opaque again when %s shows it', async (_label, show) => {
    const editor = shownEditor();
    await hideWindowsForCapture();
    expect(visibility(editor)).toEqual(HIDDEN_TRANSPARENT);

    await show();

    expect(visibility(editor)).toEqual(SHOWN_OPAQUE);
  });

  it.each([
    ['createPreferencesWindow', () => createPreferencesWindow()],
    ['restoreWindowsAfterCapture', () => restoreWindowsAfterCapture()],
  ])('Preferences is opaque again when %s shows it', async (_label, show) => {
    const preferences = await shownPreferences();
    await hideWindowsForCapture();
    expect(visibility(preferences)).toEqual(HIDDEN_TRANSPARENT);

    await show();

    expect(visibility(preferences)).toEqual(SHOWN_OPAQUE);
  });

  it('a window whose show event never arrives is opaque when the capture ends', async () => {
    const editor = shownEditor();
    editor.emitsShow = false;
    await hideWindowsForCapture();
    editor.show();
    expect(editor.opacity).toBe(0);

    restoreWindowsAfterCapture();

    expect(visibility(editor)).toEqual(SHOWN_OPAQUE);
  });

  it('a window that fails to hide stays opaque', async () => {
    const editor = shownEditor();
    editor.hide = () => {
      throw new Error('Object has been destroyed');
    };

    await hideWindowsForCapture();

    expect(visibility(editor)).toEqual(SHOWN_OPAQUE);
  });
});

describe('capture sessions', () => {
  it('a cancelled capture shows the editor and Preferences opaque', async () => {
    const editor = shownEditor();
    const preferences = await shownPreferences();

    expect(await startCapture('hotkey')).toBe(true);
    expect(editor.calls.slice(-2)).toEqual(['opacity 0', 'hide']);
    expect(visibility(editor)).toEqual(HIDDEN_TRANSPARENT);
    expect(visibility(preferences)).toEqual(HIDDEN_TRANSPARENT);

    expect(await cancelCapture('escape')).toBe(true);
    expect(visibility(editor)).toEqual(SHOWN_OPAQUE);
    expect(visibility(preferences)).toEqual(SHOWN_OPAQUE);
  });

  it('a failed capture shows the editor opaque with the failure', async () => {
    const editor = shownEditor();
    expect(await startCapture('hotkey')).toBe(true);
    expect(visibility(editor)).toEqual(HIDDEN_TRANSPARENT);
    (desktopCapturer.getSources as jest.Mock).mockResolvedValue([]);

    expect(
      await confirmCapture({
        kind: 'screen',
        sourceId: 'screen:9:0',
        displayId: '9',
      }),
    ).toBe(false);

    expect(visibility(editor)).toEqual(SHOWN_OPAQUE);
    expect(lastCaptureResult(editor)).toMatchObject({
      ok: false,
      reason: 'source-unavailable',
    });
  });

  it('a display capture delivers the snapshot taken before the overlays', async () => {
    const editor = shownEditor();
    expect(await startCapture('hotkey')).toBe(true);
    (desktopCapturer.getSources as jest.Mock).mockImplementation(
      sourcesShowing('overlay on screen'),
    );

    expect(
      await confirmCapture({
        kind: 'screen',
        sourceId: 'screen:7:0',
        displayId: '7',
      }),
    ).toBe(true);

    expect(overlays().every((w) => w.destroyed)).toBe(true);
    const result = lastCaptureResult(editor);
    expect(result).toMatchObject({
      ok: true,
      screenshot: {
        width: 1600,
        height: 1200,
        scaleFactor: 2,
        sourceId: 'screen:7:0',
        displayId: '7',
        isDisplayCapture: true,
      },
    });
    const capture = captureAssets.get(result.screenshot.assetId);
    expect(capture?.png().toString()).toBe('before overlays');
    expect(captureAssets.size()).toBe(1);
    expect(visibility(editor)).toEqual(SHOWN_OPAQUE);
  });

  it('the Displays panel previews a screen from its snapshot', async () => {
    shownEditor();
    expect(await startCapture('hotkey')).toBe(true);
    (desktopCapturer.getSources as jest.Mock).mockImplementation(
      sourcesShowing('overlay on screen'),
    );
    const [, listSources] = (ipcMain.handle as jest.Mock).mock.calls.find(
      ([channel]) => channel === 'list-capture-sources',
    );
    const previewOf = (assetId: string | null) =>
      captureAssets
        .get(assetId ?? '')
        ?.png()
        .toString();

    const screens: ListCaptureSourcesResponse = await listSources(
      {},
      { type: 'screen' },
    );
    const windowSources: ListCaptureSourcesResponse = await listSources(
      {},
      { type: 'window' },
    );

    expect(previewOf(screens[0].thumbnailAssetId)).toBe(
      'before overlays at 320',
    );
    expect(previewOf(windowSources[0].thumbnailAssetId)).toBe(
      'overlay on screen window at 320',
    );
  });

  it('opens overlays without window buttons', async () => {
    shownEditor();

    expect(await startCapture('hotkey')).toBe(true);

    expect(overlays()).toHaveLength(1);
    expect(overlays()[0].options).toMatchObject({ frame: false });
    expect(overlays()[0].options).not.toHaveProperty('titleBarStyle');
  });
});
