import { BrowserWindow, ipcMain, type IpcMainInvokeEvent } from 'electron';
import {
  performWindowAction,
  snapshotWindowState,
  windowControlAction,
} from '../window-state';

/** The window whose page sent the request; each controls only itself. */
const senderWindow = (event: IpcMainInvokeEvent): BrowserWindow | null => {
  const win = BrowserWindow.fromWebContents(event.sender);
  return win && !win.isDestroyed() ? win : null;
};

export default function registerWindowIpcHandlers(): void {
  ipcMain.handle('window-control', async (event, payload: unknown) => {
    const action = windowControlAction(payload);
    const win = senderWindow(event);
    if (!action || !win) return false;
    performWindowAction(win, action);
    return true;
  });

  ipcMain.handle('get-window-state', async (event) =>
    snapshotWindowState(senderWindow(event)),
  );
}
