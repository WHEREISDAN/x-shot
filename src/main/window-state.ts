import type { BrowserWindow } from 'electron';
import type { WindowControlAction, WindowState } from '../shared/ipc-types';

const ACTIONS: readonly WindowControlAction[] = [
  'minimize',
  'maximize',
  'unmaximize',
  'close',
  'toggle-maximize',
];

export function snapshotWindowState(win: BrowserWindow | null): WindowState {
  const live = win && !win.isDestroyed() ? win : null;
  return {
    isMaximized: !!live?.isMaximized(),
    isFullScreen: !!live?.isFullScreen(),
    isFocused: !!live?.isFocused(),
    platform: process.platform as WindowState['platform'],
  };
}

/** The action in a 'window-control' payload, or null if it is not one. */
export function windowControlAction(
  payload: unknown,
): WindowControlAction | null {
  if (typeof payload !== 'object' || payload === null) return null;
  const { action } = payload as { action?: unknown };
  return ACTIONS.includes(action as WindowControlAction)
    ? (action as WindowControlAction)
    : null;
}

export function performWindowAction(
  win: BrowserWindow,
  action: WindowControlAction,
): void {
  switch (action) {
    case 'minimize':
      win.minimize();
      break;
    case 'maximize':
      if (!win.isMaximized()) win.maximize();
      break;
    case 'unmaximize':
      if (win.isMaximized()) win.unmaximize();
      break;
    case 'toggle-maximize':
      if (win.isMaximized()) win.unmaximize();
      else win.maximize();
      break;
    case 'close':
      win.close();
      break;
    default:
      break;
  }
}

/** Sends a window its own state whenever it changes. */
export function trackWindowState(win: BrowserWindow): void {
  const emit = () => {
    if (win.isDestroyed()) return;
    win.webContents.send('window-state', snapshotWindowState(win));
  };
  win.on('maximize', emit);
  win.on('unmaximize', emit);
  win.on('enter-full-screen', emit);
  win.on('leave-full-screen', emit);
  win.on('focus', emit);
  win.on('blur', emit);
  win.webContents.on('did-finish-load', emit);
}
