import { ipcMain } from 'electron';
import { getMainWindow } from '../windows';
import type {
  IpcInvokes,
  WindowState,
  WindowControlAction,
} from '../../shared/ipc-types';

function snapshotWindowState(): WindowState {
  const win = getMainWindow();
  return {
    isMaximized: !!win?.isMaximized(),
    isFullScreen: !!win?.isFullScreen(),
    isFocused: !!win?.isFocused(),
    platform: process.platform as WindowState['platform'],
  };
}

function performAction(action: WindowControlAction): boolean {
  const win = getMainWindow();
  if (!win) return false;
  switch (action) {
    case 'minimize':
      win.minimize();
      return true;
    case 'maximize':
      if (!win.isMaximized()) win.maximize();
      return true;
    case 'unmaximize':
      if (win.isMaximized()) win.unmaximize();
      return true;
    case 'toggle-maximize':
      if (win.isMaximized()) win.unmaximize();
      else win.maximize();
      return true;
    case 'close':
      win.close();
      return true;
    default:
      return false;
  }
}

export default function registerWindowIpcHandlers(): void {
  ipcMain.handle(
    'window-control',
    async (_e, payload: IpcInvokes['window-control']['req']) => {
      return performAction(payload.action);
    },
  );

  ipcMain.handle('get-window-state', async () => {
    return snapshotWindowState();
  });
}

export function setupWindowStateEvents(): void {
  const win = getMainWindow();
  if (!win) return;

  const emit = () => {
    const state = snapshotWindowState();
    win.webContents.send('window-state', state);
  };

  win.on('maximize', emit);
  win.on('unmaximize', emit);
  win.on('enter-full-screen', emit);
  win.on('leave-full-screen', emit);
  win.on('focus', emit);
  win.on('blur', emit);
  win.webContents.once('did-finish-load', emit);
}
