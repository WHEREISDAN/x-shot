import { contextBridge, ipcRenderer, IpcRendererEvent } from 'electron';
import type {
  RendererToMainPayloads,
  MainToRendererEvents,
  IpcInvokes,
  WindowState,
  LogMessage,
} from '../shared/ipc-types';

export type Channels =
  | keyof RendererToMainPayloads
  | keyof MainToRendererEvents
  | keyof IpcInvokes;

type Listener<K extends keyof MainToRendererEvents> = (
  payload: MainToRendererEvents[K],
) => void;

const sendChannels = new Set<keyof RendererToMainPayloads>([
  'ipc-example',
  'screenshot-capture',
  'screenshot-cancel',
  'screenshot-window',
  'screenshot-screen',
  'screenshot-data',
  'log',
]);

const receiveChannels = new Set<keyof MainToRendererEvents>([
  'ipc-example',
  'screenshot-data',
  'window-state',
]);

const invokeChannels = new Set<keyof IpcInvokes>([
  'list-capture-sources',
  'get-display-snapshot',
  'release-display-snapshots',
  'copy-image',
  'save-image',
  'window-control',
  'get-window-state',
  'get-preferences',
  'set-preferences',
  'open-preferences-window',
  'reset-preferences',
  'select-folder',
]);

function assertAllowed<T extends string>(channel: T, allowed: Set<T>): void {
  if (!allowed.has(channel)) {
    throw new Error(`IPC channel is not allowed: ${channel}`);
  }
}

const electronHandler = {
  ipcRenderer: {
    sendMessage<K extends keyof RendererToMainPayloads>(
      channel: K,
      payload: RendererToMainPayloads[K],
    ) {
      assertAllowed(channel, sendChannels);
      ipcRenderer.send(channel as string, payload as unknown);
    },
    on<K extends keyof MainToRendererEvents>(channel: K, func: Listener<K>) {
      assertAllowed(channel, receiveChannels);
      const subscription = (
        _event: IpcRendererEvent,
        payload: MainToRendererEvents[K],
      ) => func(payload);
      ipcRenderer.on(channel as string, subscription);

      return () => {
        ipcRenderer.removeListener(channel as string, subscription);
      };
    },
    once<K extends keyof MainToRendererEvents>(channel: K, func: Listener<K>) {
      assertAllowed(channel, receiveChannels);
      ipcRenderer.once(channel as string, (_event, payload) => func(payload));
    },
    invoke<K extends keyof IpcInvokes>(
      channel: K,
      payload: IpcInvokes[K]['req'],
    ): Promise<IpcInvokes[K]['res']> {
      assertAllowed(channel, invokeChannels);
      return ipcRenderer.invoke(channel as string, payload);
    },
    log(payload: LogMessage) {
      ipcRenderer.send('log', payload);
    },
  },
  windowControls: {
    minimize(): Promise<boolean> {
      return ipcRenderer.invoke('window-control', { action: 'minimize' });
    },
    toggleMaximize(): Promise<boolean> {
      return ipcRenderer.invoke('window-control', {
        action: 'toggle-maximize',
      });
    },
    close(): Promise<boolean> {
      return ipcRenderer.invoke('window-control', { action: 'close' });
    },
    getState(): Promise<WindowState> {
      return ipcRenderer.invoke('get-window-state');
    },
    onState(listener: (state: WindowState) => void): () => void {
      const subscription = (_e: IpcRendererEvent, payload: WindowState) =>
        listener(payload);
      ipcRenderer.on('window-state', subscription);
      return () => ipcRenderer.removeListener('window-state', subscription);
    },
  },
};

contextBridge.exposeInMainWorld('electron', electronHandler);

export type ElectronHandler = typeof electronHandler;
