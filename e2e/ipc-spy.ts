import type { WebContents } from 'electron';
import type { PackagedApp } from './packaged-app';

export interface IpcRecord {
  direction: 'to-renderer' | 'send' | 'invoke';
  channel: string;
  /** True when any string in the payload contains a data: URL. */
  hasDataUrl: boolean;
}

/**
 * Records every IPC message between main and any renderer, in both
 * directions, from now on, including windows created later.
 */
export async function spyOnIpc({ app }: PackagedApp): Promise<void> {
  await app.evaluate(({ app: electronApp, ipcMain, webContents }) => {
    const records: IpcRecord[] = [];
    Object.assign(global, { xshotIpcRecords: records });

    const hasDataUrl = (value: unknown, depth = 0): boolean => {
      if (typeof value === 'string') {
        return /data:[a-z]+\/[\w.+-]+[;,]/i.test(value);
      }
      if (depth > 8 || value === null || typeof value !== 'object') {
        return false;
      }
      if (ArrayBuffer.isView(value) || value instanceof ArrayBuffer) {
        return false;
      }
      return Object.values(value).some((v) => hasDataUrl(v, depth + 1));
    };
    const record = (
      direction: IpcRecord['direction'],
      channel: string,
      args: unknown,
    ) => records.push({ direction, channel, hasDataUrl: hasDataUrl(args) });

    const instrument = (contents: WebContents) => {
      const send = contents.send.bind(contents);
      Object.assign(contents, {
        send: (channel: string, ...args: unknown[]) => {
          record('to-renderer', channel, args);
          send(channel, ...args);
        },
      });
      contents.on('ipc-message', (_event, channel, ...args) =>
        record('send', channel, args),
      );
    };
    // ipcRenderer.invoke has no public event in main, so every handler in
    // ipcMain's (internal) handler map is wrapped, including ones added
    // later. The test checks that invokes were seen.
    type Handler = (event: unknown, ...args: unknown[]) => unknown;
    const handlersKey = '_invokeHandlers';
    const handlers = (
      ipcMain as unknown as Record<string, Map<string, Handler>>
    )[handlersKey];
    const setHandler = handlers.set.bind(handlers);
    const wrap =
      (channel: string, handler: Handler): Handler =>
      (event, ...args) => {
        record('invoke', channel, args);
        return handler(event, ...args);
      };
    handlers.forEach((handler, channel) =>
      setHandler(channel, wrap(channel, handler)),
    );
    Object.assign(handlers, {
      set: (channel: string, handler: Handler) =>
        setHandler(channel, wrap(channel, handler)),
    });

    webContents.getAllWebContents().forEach(instrument);
    electronApp.on('web-contents-created', (_event, contents) =>
      instrument(contents),
    );
  });
}

export async function ipcRecords({ app }: PackagedApp): Promise<IpcRecord[]> {
  return app.evaluate(
    () =>
      (global as unknown as { xshotIpcRecords: IpcRecord[] }).xshotIpcRecords,
  );
}
