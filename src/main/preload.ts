// Disable no-unused-vars, broken for spread args
/* eslint no-unused-vars: off */
import { contextBridge, ipcRenderer, IpcRendererEvent } from 'electron';
import type {
  RendererToMainPayloads,
  MainToRendererEvents,
  IpcInvokes,
  WindowState,
} from '../shared/ipc-types';

export type Channels =
  | keyof RendererToMainPayloads
  | keyof MainToRendererEvents
  | keyof IpcInvokes;

type Listener<K extends keyof MainToRendererEvents> = (
  payload: MainToRendererEvents[K],
) => void;

const electronHandler = {
  ipcRenderer: {
    sendMessage<K extends keyof RendererToMainPayloads>(
      channel: K,
      payload: RendererToMainPayloads[K],
    ) {
      ipcRenderer.send(channel as string, payload as unknown);
    },
    on<K extends keyof MainToRendererEvents>(channel: K, func: Listener<K>) {
      const subscription = (
        _event: IpcRendererEvent,
        payload: MainToRendererEvents[K],
      ) => func(payload);
      ipcRenderer.on(channel as string, subscription as any);

      return () => {
        ipcRenderer.removeListener(channel as string, subscription as any);
      };
    },
    once<K extends keyof MainToRendererEvents>(channel: K, func: Listener<K>) {
      ipcRenderer.once(channel as string, (_event, payload) => func(payload));
    },
    invoke<K extends keyof IpcInvokes>(
      channel: K,
      payload: IpcInvokes[K]['req'],
    ): Promise<IpcInvokes[K]['res']> {
      return ipcRenderer.invoke(channel as string, payload);
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
      ipcRenderer.on('window-state', subscription as any);
      return () =>
        ipcRenderer.removeListener('window-state', subscription as any);
    },
  },
};

contextBridge.exposeInMainWorld('electron', electronHandler);

export type ElectronHandler = typeof electronHandler;
